import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "react-router";
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

function customizationForThisFunction(nodes: DeliveryCustomizationNode[]) {
  return nodes.find((node) => node.shopifyFunction?.handle === FUNCTION_HANDLE) || null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);

  const isTestBilling =
    process.env.NODE_ENV !== "production" ||
    session.shop === "app-check-store-cnxiyewx.myshopify.com";

  // Enforce active subscription
  const billingCheck = await billing.require({
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

      const createJson = await createResponse.json();
      const errors = createJson.data?.deliveryCustomizationCreate?.userErrors || [];
      return { success: errors.length === 0, errors };
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

      const updateJson = await updateResponse.json();
      const errors = updateJson.data?.deliveryCustomizationUpdate?.userErrors || [];
      return { success: errors.length === 0, errors };
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
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

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

  const isSaving = navigation.state === "submitting";

  const handleSave = () => {
    const parsedAmount = Number(minSubtotal);
    const validAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0;

    if (!validAmount) {
      return;
    }

    submit({ hideKeywords: keywords, minSubtotal: String(parsedAmount) }, { method: "post" });
  };

  return (
    <Page title="Shipping Option Hider">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData?.success && (
              <Banner title="Configuration saved successfully!" tone="success" />
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