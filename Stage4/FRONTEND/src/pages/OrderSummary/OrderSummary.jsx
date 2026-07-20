import "./OrderSummary.css";
import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import {
  authRequest,
  isAuthenticated,
  getCurrentUser,
} from "../../services/auth";
const PLAN_PRICE = 250.0;
const TIME_SLOTS = [
  { value: "12:00", label: "12:00 PM – 3:00 PM" },
  { value: "15:00", label: "3:00 PM – 5:00 PM" },
  { value: "17:00", label: "5:00 PM – 7:00 PM" },
];
function OrderSummary() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [createdSub, setCreatedSub] = useState(null);

  if (!state || !state.days || state.days.length === 0) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Navbar />
        <main
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "64px 32px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            No meal selection found
          </h1>
          <p style={{ color: "#5e5e5b", marginBottom: 24 }}>
            Start by choosing your meals for the week.
          </p>
          <Link to="/restaurants" style={{ color: "#325f3f", fontWeight: 600 }}>
            Browse restaurants →
          </Link>
        </main>
      </div>
    );
  }
  const discountAmount = appliedDiscount
    ? Math.round(PLAN_PRICE * Number(appliedDiscount.discount_percentage)) / 100
    : 0;
  const finalPrice = PLAN_PRICE - discountAmount;
  const handleApplyCode = async () => {
    const code = discountInput.trim();
    if (!code) return;
    setDiscountError("");
    setIsApplying(true);
    try {
      const result = await authRequest("/api/discount-codes/validate", "POST", {
        code,
      });
      setAppliedDiscount(result);
    } catch (err) {
      setAppliedDiscount(null);
      setDiscountError(err.message);
    } finally {
      setIsApplying(false);
    }
  };
  const handleRemoveCode = () => {
    setAppliedDiscount(null);
    setDiscountInput("");
    setDiscountError("");
  };
  const handlePay = async (e) => {
    e.preventDefault();
    setError("");
    if (!isAuthenticated()) {
      navigate("/login", {
        state: { redirectTo: "/order-summary", redirectState: state },
      });
      return;
    }
    const user = getCurrentUser();
    if (user?.user_type !== "client") {
      setError(
        "Only customer accounts can subscribe. Please log in as a customer.",
      );
      return;
    }
    const expiryMatch = expiry.match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/);
    if (!expiryMatch) {
      setError("Expiry date must be in MM/YY format.");
      return;
    }
    setIsPaying(true);
    try {
      let sub = createdSub;
      if (!sub) {
        setStep("Creating your subscription…");
        const newSub = await authRequest("/api/subscriptions", "POST", {
          start_date: state.startDate,
          end_date: state.endDate,
          delivery_time: deliveryTime,
          discount_code_id: appliedDiscount?.discount_code_id ?? null,
        });
        setStep("Saving your meal selections…");
        await authRequest("/api/meal-selections", "POST", {
          subscription_id: newSub.subscription_id,
          selections: state.days.map((d) => ({
            meal_id: d.meal_id,
            day_date: d.iso,
            day_of_week: d.full,
          })),
        });

        setCreatedSub(newSub);
        sub = newSub;
      }
      setStep("Contacting the payment gateway…");
      const payment = await authRequest("/api/payments", "POST", {
        subscription_id: sub.subscription_id,
        card_number: cardNumber.replace(/\s+/g, ""),
        card_expiry_month: Number(expiryMatch[1]),
        card_expiry_year: 2000 + Number(expiryMatch[2]),
        card_cvc: cvv,
        card_holder_name: cardName,
      });
      if (payment.transaction_url) {
        setStep("Redirecting to secure card verification…");
        window.location.assign(payment.transaction_url);
      } else {
        setError("Payment could not be started. Please try again.");
        setIsPaying(false);
      }
    } catch (err) {
      setError(err.message);
      setIsPaying(false);
      setStep("");
    }
  };
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div className="os-body">
        <Navbar />
        <main className="os-main">
          <h1 className="os-title">Complete Your Payment</h1>
          <p className="os-secure">
            <span className="os-dot" /> Secure checkout powered by Moyasar —
            card verification via 3-D Secure
          </p>
          <div className="os-grid">
            <div className="os-card">
              <div className="os-card-title">Order Summary</div>

              <div className="os-plan-row">
                <div>
                  <span className="os-address-label">Plan</span>
                  <strong>Weekly Lunch (Sun–Thu)</strong>
                </div>
              </div>
              <div className="os-address-label">Week</div>
              <div className="os-address">
                {state.startDate} → {state.endDate}
              </div>
              <div className="os-field">
                <label className="os-label">Delivery Time</label>
                <select
                  className="os-select"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  required
                >
                  <option value="">Select a delivery window</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="os-field">
                <label className="os-label">Discount Code</label>
                {appliedDiscount ? (
                  <p className="os-discount-success">
                    Code "{appliedDiscount.code}" applied —{" "}
                    {Number(appliedDiscount.discount_percentage)}% off!
                    {!createdSub && (
                      <button
                        type="button"
                        className="os-remove-code"
                        onClick={handleRemoveCode}
                      >
                        Remove
                      </button>
                    )}
                  </p>
                ) : createdSub ? (
                  <p className="os-note" style={{ marginTop: 0 }}>
                    Order already created — the discount can no longer be
                    changed for this attempt.
                  </p>
                ) : (
                  <>
                    <div className="os-discount-row">
                      <input
                        className="os-input"
                        type="text"
                        placeholder="e.g. SAVE10"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="os-apply-btn"
                        onClick={handleApplyCode}
                        disabled={isApplying || !discountInput.trim()}
                      >
                        {isApplying ? "Checking…" : "Apply"}
                      </button>
                    </div>
                    {discountError && (
                      <p className="os-discount-error">{discountError}</p>
                    )}
                  </>
                )}
              </div>

              <div className="os-meals-title">Selected Meals</div>
              {state.days.map((d) => (
                <div className="os-meal-row" key={d.iso}>
                  <div>
                    <div className="os-meal-name">{d.name}</div>
                    <div className="os-meal-restaurant">
                      {d.restaurant_name} · {d.full}, {d.iso}
                    </div>
                  </div>
                  <span className="os-meal-price">{d.calories} kcal</span>
                </div>
              ))}

              <hr className="os-divider" />

              <div className="os-sum-row">
                <span>Weekly Plan (5 meals)</span>
                <span>SAR {PLAN_PRICE.toFixed(2)}</span>
              </div>
              {appliedDiscount && (
                <div className="os-sum-row discount">
                  <span>Discount ({appliedDiscount.code})</span>
                  <span>− SAR {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="os-sum-row">
                <span>Delivery Fee</span>
                <span>FREE</span>
              </div>
              <div className="os-total-row">
                <span>Final Price</span>
                <span>SAR {finalPrice.toFixed(2)}</span>
              </div>

              <p className="os-note">
                Meals are delivered to your saved address at the selected time,
                Sunday to Thursday.
              </p>
            </div>

            <div className="os-card">
              <div className="os-card-title">Payment Details</div>

              <form onSubmit={handlePay}>
                <div className="os-field">
                  <label className="os-label">Cardholder Name</label>
                  <input
                    className="os-input"
                    type="text"
                    placeholder="e.g. Abdullah Ahmed"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    required
                  />
                </div>

                <div className="os-field">
                  <label className="os-label">Card Number</label>
                  <input
                    className="os-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="os-row2">
                  <div className="os-field">
                    <label className="os-label">Expiry Date</label>
                    <input
                      className="os-input"
                      type="text"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      required
                    />
                  </div>
                  <div className="os-field">
                    <label className="os-label">CVV</label>
                    <input
                      className="os-input"
                      type="password"
                      inputMode="numeric"
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && <div className="os-error">{error}</div>}

                {!deliveryTime && (
                  <p
                    className="os-error"
                    style={{ background: "transparent", padding: 0 }}
                  >
                    Please select a delivery time before paying.
                  </p>
                )}

                <button
                  className="os-pay-btn"
                  type="submit"
                  disabled={isPaying || !deliveryTime}
                >
                  {isPaying
                    ? "Processing…"
                    : `Pay Now — SAR ${finalPrice.toFixed(2)}`}
                </button>

                {step && <p className="os-step">{step}</p>}
                <p className="os-secure-note">
                  🔒 After paying you'll be taken to your bank's 3-D Secure page
                  to verify the card.
                </p>
              </form>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
export default OrderSummary;
