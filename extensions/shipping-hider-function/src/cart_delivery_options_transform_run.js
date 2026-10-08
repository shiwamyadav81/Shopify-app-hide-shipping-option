// @ts-check

/**
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 * @typedef {import("../generated/api").Operation} Operation
 */

/**
 * @typedef {Object} DeliveryOptionInput
 * @property {string} [handle]
 * @property {string | null} [title]
 * @property {string | null} [code]
 * @property {{ amount?: string | number | null } | null} [cost]
 */

/**
 * @typedef {Object} FunctionConfiguration
 * @property {unknown} [hideKeywords]
 * @property {number} [minSubtotal]
 */

const DEFAULT_MIN_SUBTOTAL = 200;
const NO_CHANGES = {
  operations: [],
};

/**
 * Checkout can pass the saved JSON metafield already parsed (`jsonValue`)
 * or as a string (`value`). Accept either shape.
 * @param {{ jsonValue?: unknown, value?: string | null } | null | undefined} metafield
 * @returns {FunctionConfiguration}
 */
function readConfiguration(metafield) {
  if (!metafield) return {};

  const { jsonValue, value } = metafield;
  if (jsonValue && typeof jsonValue === "object") {
    return /** @type {FunctionConfiguration} */ (jsonValue);
  }

  const raw =
    typeof jsonValue === "string"
      ? jsonValue
      : typeof value === "string"
        ? value
        : "";

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? /** @type {FunctionConfiguration} */ (parsed)
      : {};
  } catch {
    return {};
  }
}

/**
 * @param {FunctionConfiguration} configuration
 * @returns {string[]}
 */
function hideKeywordsFrom(configuration) {
  if (!Array.isArray(configuration.hideKeywords)) return [];

  return configuration.hideKeywords
    .map((keyword) => String(keyword).toLowerCase().trim())
    .filter(Boolean);
}

/**
 * @param {FunctionConfiguration} configuration
 * @returns {number}
 */
function minSubtotalFrom(configuration) {
  const value = Number(configuration.minSubtotal);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MIN_SUBTOTAL;
}

/**
 * The name shown at checkout can be `title` or `code` (for example "Standard").
 * @param {DeliveryOptionInput} option
 */
function optionLabel(option) {
  return `${option.title || ""} ${option.code || ""}`.toLowerCase();
}

/**
 * @param {DeliveryOptionInput} option
 */
function optionCost(option) {
  const amount = parseFloat(String(option.cost?.amount ?? ""));
  return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
}

/**
 * Checkout rejects a delivery group when every option is hidden.
 * If the keywords match all of them, keep the cheapest one.
 * @param {DeliveryOptionInput[]} options
 * @param {string[]} hideKeywords
 * @returns {DeliveryOptionInput[]}
 */
function optionsToHide(options, hideKeywords) {
  const hideable = options.filter((option) => option.handle);
  const matches = hideable.filter((option) =>
    hideKeywords.some((keyword) => optionLabel(option).includes(keyword))
  );

  if (matches.length === 0 || matches.length < hideable.length) {
    return matches;
  }

  const [kept] = [...matches].sort((left, right) => optionCost(left) - optionCost(right));
  return matches.filter((option) => option.handle !== kept?.handle);
}

/**
 * @param {import("../generated/api").RunInput} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function run(input) {
  const configuration = readConfiguration(input?.deliveryCustomization?.metafield);
  const hideKeywords = hideKeywordsFrom(configuration);
  const minSubtotal = minSubtotalFrom(configuration);

  if (!hideKeywords.length) {
    return NO_CHANGES;
  }

  // Extract cart subtotal amount
  const subtotalAmount = parseFloat(input?.cart?.cost?.subtotalAmount?.amount || "0");

  // Only apply hide logic when the cart subtotal exceeds the configured minimum.
  if (subtotalAmount <= minSubtotal) {
    return NO_CHANGES;
  }

  /** @type {Operation[]} */
  const operations = [];

  for (const group of input?.cart?.deliveryGroups || []) {
    for (const option of optionsToHide(group?.deliveryOptions || [], hideKeywords)) {
      if (!option.handle) continue;
      operations.push({
        deliveryOptionHide: {
          deliveryOptionHandle: option.handle,
        },
      });
    }
  }

  return { operations };
}

export default run;
