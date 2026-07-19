import "./PaymentResult.css";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";

// Landing page for the Moyasar callback redirect after 3-D Secure.
// Query params: status=success|failed|pending|error, subscription_id, message.
function PaymentResult() {
  const [params] = useSearchParams();
  const status = params.get("status") || "error";
  const subscriptionId = params.get("subscription_id");
  const message = params.get("message");

  const view = {
    success: {
      icon: "✅",
      title: "Payment Successful",
      desc: `Your weekly meal subscription${subscriptionId ? ` #${subscriptionId}` : ""} is confirmed. Your meals will be delivered Sunday to Thursday.`,
      cta: { to: "/dashboard", label: "View My Dashboard" },
    },
    failed: {
      icon: "❌",
      title: "Payment Failed",
      desc: message || "Your card was declined. No amount was charged.",
      cta: { to: "/restaurants", label: "Try Again" },
    },
    pending: {
      icon: "⏳",
      title: "Payment Pending",
      desc: "Your payment has not been completed yet. Check your dashboard shortly.",
      cta: { to: "/dashboard", label: "Go to Dashboard" },
    },
    error: {
      icon: "⚠️",
      title: "Something Went Wrong",
      desc: message || "We could not verify your payment. Contact support if you were charged.",
      cta: { to: "/dashboard", label: "Go to Dashboard" },
    },
  }[status] || {
    icon: "⚠️",
    title: "Unknown Payment Status",
    desc: "We could not determine the payment result.",
    cta: { to: "/dashboard", label: "Go to Dashboard" },
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
     

      <div className="pres-body">
        <Navbar />
        <main className="pres-main">
          <div className="pres-icon">{view.icon}</div>
          <h1 className="pres-title">{view.title}</h1>
          <p className="pres-desc">{view.desc}</p>
          <Link className="pres-cta" to={view.cta.to}>{view.cta.label}</Link>
          <Link className="pres-secondary" to="/">Back to Home</Link>
        </main>
      </div>
    </>
  );
}

export default PaymentResult;
