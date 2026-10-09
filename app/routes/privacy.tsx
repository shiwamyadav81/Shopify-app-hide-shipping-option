import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy | Shipping Option Hider" },
  {
    name: "description",
    content: "Privacy information for the Shipping Option Hider Shopify app.",
  },
];

export default function PrivacyPolicy() {
  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 24px",
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <h1>Privacy Policy</h1>
      <p>Last updated: October 9, 2026</p>

      <p>
        This policy describes how Shipping Option Hider (the “App”), operated
        by Shiwam Yadav, handles information when a merchant installs or uses
        the App. The App is intended for Shopify merchants generally and may
        be used by merchants in different countries.
      </p>

      <h2>Information the App processes</h2>
      <ul>
        <li>
          Shopify shop and authorization information, including the shop
          domain, granted permissions, access and refresh tokens, and token
          expiration information, to authenticate the App and make authorized
          Shopify API requests.
        </li>
        <li>
          Shopify staff account information that Shopify includes in
          authorization sessions, which can include a staff member’s name,
          email address, user ID, language, and account or collaborator status.
        </li>
        <li>
          The shipping option keywords and minimum subtotal configured by the
          merchant. The App stores this rule in a Shopify delivery
          customization metafield; it does not store customer, order, payment,
          or shipping-address records in its own database.
        </li>
        <li>
          Operational information in Render logs. Web request logs can include
          request paths and query parameters, and Shopify embedded requests can
          include temporary authentication parameters such as tokens or
          signatures. Application webhook logs include the shop domain and
          webhook topic.
        </li>
      </ul>

      <h2>How information is used</h2>
      <p>
        The App uses authorization information to provide its functionality,
        save and retrieve the merchant’s shipping rules, maintain the
        installation, and respond to Shopify privacy and lifecycle requests.
        The App does not sell personal information or use it for advertising.
      </p>

      <h2>Where information is processed</h2>
      <p>
        App session data is stored in a Neon-hosted PostgreSQL database, and
        the App is hosted by Render. Shopify processes the rule configuration
        and provides the APIs, app platform, and webhook delivery. These
        providers may process information in the United States, including in
        the configured Render region (Oregon, US West) and Neon region
        (us-east-2).
      </p>

      <h2>Retention and deletion</h2>
      <p>
        While the App remains installed, authorization session data is retained
        as needed to operate the App. When the App is uninstalled, its
        app/uninstalled webhook deletes that shop’s stored sessions. The
        shop/redact compliance webhook also deletes stored sessions when
        Shopify sends a shop deletion request. The App does not retain customer
        records in its own database.
      </p>
      <p>
        Render operational logs are retained for up to 7 days. Neon
        point-in-time restore history is
        configured for 6 hours and may retain deleted database data within
        that history window. Shopify retains the merchant’s delivery
        customization according to Shopify’s own systems and settings.
      </p>

      <h2>Sharing</h2>
      <p>
        Information is shared with Shopify as needed to provide the App and
        with Render and Neon to host and operate it. These providers process
        information to provide their services under their own terms and
        privacy practices. The App does not sell personal information.
      </p>

      <h2>Privacy requests and contact</h2>
      <p>
        For questions or privacy requests, contact{" "}
        <a href="mailto:shiwamyadav81@gmail.com">shiwamyadav81@gmail.com</a>.
        Shopify merchants can also contact Shopify about information Shopify
        processes. The App responds to Shopify’s required customer data and
        redaction webhooks.
      </p>
      <p>
        Depending on applicable law, individuals may have rights to request
        access to, correction of, or deletion of personal information, or to
        object to or restrict certain processing. Merchants can also uninstall
        the App to end its access to their store.
      </p>

      <h2>Location and applicable law</h2>
      <p>
        The App operator is based in India. The App and its providers may
        process information in the United States as described above. Privacy
        rights and obligations may depend on the laws that apply to the
        merchant or individual. For privacy requests, contact the App operator
        at the email address above.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        This policy may be updated as the App or its data practices change.
        The latest version will be published at this URL with its updated date.
      </p>
    </main>
  );
}
