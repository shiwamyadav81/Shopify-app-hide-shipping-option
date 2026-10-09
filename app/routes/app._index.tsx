import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  Text,
  Banner,
  Box,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

const FUNCTION_HANDLE = "shipping-hider-function";
const CONFIG_NAMESPACE = "$app:shipping-hider-function";
const CONFIG_KEY = "function-configuration";

type HideConfig = { hideKeywords?: string[]; minSubtotal?: number };

type DeliveryCustomizationNode = {
  id: string;
  title: string;
  enabled: boolean;
  shopifyFunction?: { handle?: string | null } | null;
  metafield?: { jsonValue?: HideConfig | null } | null;
};

type SaveError = { message: string; field?: string[] | null };
type GraphqlPayload = {
  errors?: { message: string }[];
  data?: Record<
    string,
    { userErrors?: SaveError[]; deliveryCustomization?: { id: string } | null } | null
  >;
};

function customizationForThisFunction(nodes: DeliveryCustomizationNode[]) {
  return nodes.find((node) => node.shopifyFunction?.handle === FUNCTION_HANDLE) || null;
}

async function readMutationResult(
  response: Response,
  mutationName: string,
): Promise<{ success: boolean; errors: SaveError[] }> {
  const result = (await response.json()) as GraphqlPayload;
  const errors = [
    ...(result.errors || []),
    ...(result.data?.[mutationName]?.userErrors || []),
  ];

  if (!response.ok) {
    errors.push({ message: `Shopify API request failed (${response.status}).` });
  } else if (!result.data?.[mutationName]?.deliveryCustomization) {
    errors.push({ message: "Shopify did not return a saved shipping rule." });
  }

  return { success: errors.length === 0, errors };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);

  const isTestBilling =
    process.env.NODE_ENV !== "production" ||
    session.shop === "app-check-store-cnxiyewx.myshopify.com";

  // Enforce active subscription
  await billing.require({
    plans: [MONTHLY_PLAN],
    isTest: isTestBilling,
    onFailure: async () => {
      return billing.request({
        plan: MONTHLY_PLAN,
        isTest: isTestBilling,
      });
    },
  });

  // Extract store handle (e.g. "my-shop.myshopify.com" -> "my-shop")
  const shopHandle = session.shop.replace(".myshopify.com", "");
  try {

    const response = await admin.graphql(
      `#graphql
      query getDeliveryCustomizations {
        deliveryCustomizations(first: 25) {
          nodes {
            id
            title
            enabled
            shopifyFunction {
              handle
            }
            metafield(namespace: "${CONFIG_NAMESPACE}", key: "${CONFIG_KEY}") {
              jsonValue
            }
          }
        }
      }`
    );

    const responseJson = await response.json();
    const customizations: DeliveryCustomizationNode[] =
      responseJson.data?.deliveryCustomizations?.nodes || [];

    return { customizations, shopHandle };
  } catch (error) {
    console.error("Loader fetch error:", error);
    return { customizations: [], shopHandle };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const hideKeywordsInput = formData.get("hideKeywords") as string;
  const hideKeywords = hideKeywordsInput
    ? hideKeywordsInput.split(",").map((k) => k.trim()).filter(Boolean)
    : [];
  const minSubtotalValue = Number(formData.get("minSubtotal"));
  const minSubtotal = Number.isFinite(minSubtotalValue) && minSubtotalValue >= 0
    ? minSubtotalValue
    : 200;
  const configurationValue = JSON.stringify({ hideKeywords, minSubtotal });

  try {
    // 1. Fetch existing delivery customizations
    const existingCustomizationsResponse = await admin.graphql(
      `#graphql
      query getDeliveryCustomizations {
        deliveryCustomizations(first: 25) {
          nodes {
            id
            title
            shopifyFunction {
              handle
            }
          }
        }
      }`
    );

    const existingJson = await existingCustomizationsResponse.json();
    const existingRules: DeliveryCustomizationNode[] =
      existingJson.data?.deliveryCustomizations?.nodes || [];
    const customizationId = customizationForThisFunction(existingRules)?.id;

    // 2. Pass metafields inside the single mutation call
    if (!customizationId) {
      const createResponse = await admin.graphql(
        `#graphql
        mutation deliveryCustomizationCreate($deliveryCustomization: DeliveryCustomizationInput!) {
          deliveryCustomizationCreate(deliveryCustomization: $deliveryCustomization) {
            deliveryCustomization {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            deliveryCustomization: {
              title: "Hide Shipping Options Rule",
              enabled: true,
              functionHandle: FUNCTION_HANDLE,
              metafields: [
                {
                  namespace: CONFIG_NAMESPACE,
                  key: CONFIG_KEY,
                  type: "json",
                  value: configurationValue,
                },
              ],
            },
          },
        }
      );

      return await readMutationResult(
        createResponse,
        "deliveryCustomizationCreate",
      );
    } else {
      const updateResponse = await admin.graphql(
        `#graphql
        mutation deliveryCustomizationUpdate($id: ID!, $deliveryCustomization: DeliveryCustomizationInput!) {
          deliveryCustomizationUpdate(id: $id, deliveryCustomization: $deliveryCustomization) {
            deliveryCustomization {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            id: customizationId,
            deliveryCustomization: {
              title: "Hide Shipping Options Rule",
              enabled: true,
              metafields: [
                {
                  namespace: CONFIG_NAMESPACE,
                  key: CONFIG_KEY,
                  type: "json",
                  value: configurationValue,
                },
              ],
            },
          },
        }
      );

      return await readMutationResult(
        updateResponse,
        "deliveryCustomizationUpdate",
      );
    }
  } catch (error) {
    console.error("Action error:", error);
    return {
      success: false,
      errors: [
        {
          message:
            "Network connection failed. Please refresh the page and try again.",
        },
      ],
    };
  }
};

export default function Index() {
  
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const actionData = fetcher.data;

  const shopHandle = loaderData?.shopHandle || "";
  const customizations = loaderData?.customizations || [];
  const existingConfig = customizationForThisFunction(customizations)?.metafield
    ?.jsonValue as HideConfig | null;
  const initialKeywords = existingConfig?.hideKeywords
    ? existingConfig.hideKeywords.join(", ")
    : "";
  const initialMinSubtotal = existingConfig?.minSubtotal ?? 200;

  const [keywords, setKeywords] = useState(initialKeywords);
  const [minSubtotal, setMinSubtotal] = useState(String(initialMinSubtotal));
  const [successDismissed, setSuccessDismissed] = useState(false);

  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (!actionData?.success) return;

    const timeoutId = window.setTimeout(() => setSuccessDismissed(true), 5000);

    return () => window.clearTimeout(timeoutId);
  }, [actionData]);

  const handleSave = () => {
    const parsedAmount = Number(minSubtotal);
    const validAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0;

    if (!validAmount) {
      return;
    }

    setSuccessDismissed(false);
    fetcher.submit(
      { hideKeywords: keywords, minSubtotal: String(parsedAmount) },
      { method: "post" },
    );
  };

  return (
    <Page title="Shipping Option Hider">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData?.success && !successDismissed && !isSaving && (
              <Banner
                title="Configuration saved successfully!"
                tone="success"
                onDismiss={() => setSuccessDismissed(true)}
              />
            )}
            {actionData?.errors && actionData.errors.length > 0 && (
              <Banner title="Failed to save configuration" tone="critical">
                <p>
                  {actionData.errors
                    .map((e: { message: string }) => e.message)
                    .join(", ")}
                </p>
              </Banner>
            )}

            {/* // Inside your main page React component: */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">Current Subscription Plan</Text>
                  <Badge tone="success">Active</Badge>
                </InlineStack>

                <Text as="p" variant="bodyMd">
                  You are currently on the <strong>Monthly Plan ($4.99/month)</strong>.
                </Text>

                <Box paddingBlockStart="200">
                  <Button
                    url={`https://admin.shopify.com/store/${shopHandle}/settings/apps`}
                    target="_top" // Use _top to navigate the outer Shopify Admin window, not inside the iframe
                  >
                    Manage Subscription in Settings
                  </Button>
                </Box>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Hide Shipping Options at Checkout
                </Text>
                <Text as="p" variant="bodyMd">
                  Enter shipping method names or keywords (comma separated) you want to hide during checkout.
                </Text>

                <TextField
                  label="Shipping option keywords to hide"
                  value={keywords}
                  onChange={(val) => setKeywords(val)}
                  placeholder="Standard, Overnight, Expedited"
                  helpText="Separate multiple keywords with commas (e.g. Standard, Heavy Shipping)"
                  autoComplete="off"
                />

                <TextField
                  label="Minimum cart subtotal to hide options"
                  type="number"
                  value={minSubtotal}
                  onChange={(val) => setMinSubtotal(val)}
                  min={0}
                  step={0.01}
                  helpText="Shipping options are hidden only when the cart subtotal is above this amount."
                  autoComplete="off"
                />

                <Box paddingBlockStart="200">
                  <Button variant="primary" loading={isSaving} onClick={handleSave}>
                    Save Rules
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}