import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Shipping Option Hider</h1>
        <p className={styles.text}>
          Configure checkout delivery rules to hide shipping options by name
          when the cart subtotal is above an amount you choose.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list} aria-label="App features">
          <li>
            <strong>Match shipping options.</strong> Enter comma-separated
            keywords to match delivery option names or codes.
          </li>
          <li>
            <strong>Set a subtotal threshold.</strong> Rules apply only when the
            cart subtotal is above your configured amount.
          </li>
          <li>
            <strong>Keep checkout usable.</strong> If every delivery option
            matches, the least expensive option remains available.
          </li>
        </ul>
        <p>
          7-day free trial, then $4.99 USD every 30 days.
        </p>
        <p>
          <a href="/privacy">Privacy policy</a>
          {" · "}
          <a href="mailto:shiwamyadav81@gmail.com">Contact support</a>
        </p>
      </div>
    </div>
  );
}
