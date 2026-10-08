import { describe, expect, test } from "vitest";
import { run } from "../src/cart_delivery_options_transform_run";

const standardAndInternational = {
  cost: { subtotalAmount: { amount: "1079.00" } },
  deliveryGroups: [
    {
      deliveryOptions: [
        {
          handle: "standard-shipping",
          title: "Standard",
          code: "Standard",
          cost: { amount: "15.00" },
        },
        {
          handle: "international-shipping",
          title: "International Shipping",
          code: "International",
          cost: { amount: "44.00" },
        },
      ],
    },
  ],
};

describe("shipping hide behavior", () => {
  test("hides Standard when the keyword is stored as a JSON string", () => {
    const result = run({
      cart: standardAndInternational,
      deliveryCustomization: {
        metafield: {
          value: JSON.stringify({ hideKeywords: ["Standard"] }),
        },
      },
    });

    expect(result).toEqual({
      operations: [
        {
          deliveryOptionHide: {
            deliveryOptionHandle: "standard-shipping",
          },
        },
      ],
    });
  });

  test("hides Standard when the keyword is already parsed jsonValue", () => {
    const result = run({
      cart: standardAndInternational,
      deliveryCustomization: {
        metafield: {
          jsonValue: { hideKeywords: ["Standard"] },
        },
      },
    });

    expect(result.operations).toEqual([
      {
        deliveryOptionHide: {
          deliveryOptionHandle: "standard-shipping",
        },
      },
    ]);
  });

  test("hides Standard when checkout only puts the name in code", () => {
    const result = run({
      cart: {
        cost: { subtotalAmount: { amount: "1079.00" } },
        deliveryGroups: [
          {
            deliveryOptions: [
              { handle: "standard-shipping", title: null, code: "Standard", cost: { amount: "15.00" } },
              {
                handle: "international-shipping",
                title: "International Shipping",
                code: "International",
                cost: { amount: "44.00" },
              },
            ],
          },
        ],
      },
      deliveryCustomization: {
        metafield: {
          value: JSON.stringify({ hideKeywords: ["standard"] }),
        },
      },
    });

    expect(result.operations.map((operation) => operation.deliveryOptionHide?.deliveryOptionHandle)).toEqual([
      "standard-shipping",
    ]);
  });

  test("leaves the cheapest rate when every option matches", () => {
    const result = run({
      cart: standardAndInternational,
      deliveryCustomization: {
        metafield: {
          jsonValue: { hideKeywords: ["Standard", "International Shipping"] },
        },
      },
    });

    expect(result.operations).toEqual([
      {
        deliveryOptionHide: {
          deliveryOptionHandle: "international-shipping",
        },
      },
    ]);
  });

  test("does not hide when the cart subtotal is 200 or less", () => {
    const result = run({
      cart: {
        ...standardAndInternational,
        cost: { subtotalAmount: { amount: "200.00" } },
      },
      deliveryCustomization: {
        metafield: {
          value: JSON.stringify({ hideKeywords: ["Standard"] }),
        },
      },
    });

    expect(result).toEqual({ operations: [] });
  });

  test("uses a custom minimum subtotal limit", () => {
    const result = run({
      cart: {
        ...standardAndInternational,
        cost: { subtotalAmount: { amount: "150.00" } },
      },
      deliveryCustomization: {
        metafield: {
          value: JSON.stringify({ hideKeywords: ["Standard"], minSubtotal: 100 }),
        },
      },
    });

    expect(result.operations).toEqual([
      {
        deliveryOptionHide: {
          deliveryOptionHandle: "standard-shipping",
        },
      },
    ]);
  });

  test("does not hide below a custom minimum subtotal", () => {
    const result = run({
      cart: {
        ...standardAndInternational,
        cost: { subtotalAmount: { amount: "99.99" } },
      },
      deliveryCustomization: {
        metafield: {
          value: JSON.stringify({ hideKeywords: ["Standard"], minSubtotal: 100 }),
        },
      },
    });

    expect(result).toEqual({ operations: [] });
  });

  test("returns no operations when no keywords are configured", () => {
    const result = run({
      cart: standardAndInternational,
      deliveryCustomization: {
        metafield: null,
      },
    });

    expect(result).toEqual({ operations: [] });
  });
});
