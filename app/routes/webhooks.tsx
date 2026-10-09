import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      // The app does not store customer data.
      console.info(`Processed ${topic} compliance webhook for ${shop}`);
      break;
    case "SHOP_REDACT":
      await db.session.deleteMany({ where: { shop } });
      console.info(`Processed ${topic} compliance webhook for ${shop}`);
      break;
    default:
      return new Response("Unsupported webhook topic", { status: 400 });
  }

  return new Response(null, { status: 200 });
};
