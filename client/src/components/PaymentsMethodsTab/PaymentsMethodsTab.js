// components/PaymentMethodsTab/PaymentMethodsTab.jsx
import React, { useRef, useState } from "react";
import { Stack, Divider, Typography, Alert, Collapse } from "@mui/material";
import PaymentMethodList from "../PaymentMethodList/PaymentMethodList";
import PaymentMethodForm from "../PaymentMethodForm/PaymentMethodForm";
import DeleteConfirmPaymentDialog from "../DeleteConfirmPaymentDialog/DeleteConfirmPaymentDialog";
import api from "../../services/api";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripeEnabled =
  String(process.env.REACT_APP_STRIPE_ENABLED).toLowerCase() === "true";
const stripePromise = stripeEnabled && process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const PaymentMethodsTab = ({ user }) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // refetch trigger for list
  const [pmRefreshKey, setPmRefreshKey] = useState(0);

  // form UI state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create"); // "create" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const formAnchorRef = useRef(null);

  // delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);

  // alert state
  const [alert, setAlert] = useState({
    open: false,
    severity: "info", // "success" | "error" | "warning" | "info"
    message: "",
  });
  const showAlert = (severity, message) => setAlert({ open: true, severity, message });
  const closeAlert = () => setAlert((a) => ({ ...a, open: false }));

  const openCreate = () => {
    setFormMode("create");
    setEditTarget(null);
    setShowForm(true);
    setTimeout(() => formAnchorRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const openEdit = (pm) => {
    setFormMode("edit");
    setEditTarget(pm);
    setShowForm(true);
    setTimeout(() => formAnchorRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const handleSubmitPM = async (payload) => {
    if (!user?._id) return;
    try {
      setSubmitting(true);

      if (formMode === "create") {
        await api.post("/payment-methods", {
          ownerId: user._id,
          setupIntentId: payload.setupIntentId,
          nickname: payload.nickname,
          setDefault: !!payload.setDefault,
        });
        showAlert("success", "Card added successfully.");
      } else if (formMode === "edit" && editTarget?._id) {
        await api.patch(`/payment-methods/${editTarget._id}`, {
          billingName: payload.name,
          expMonth: Number(payload.expMonth),
          expYear: 2000 + Number(payload.expYear),
          nickname: payload.nickname,
        });
        showAlert("success", "Card updated successfully.");
      }

      setShowForm(false);
      setEditTarget(null);
      setPmRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong while saving the card.";
      showAlert("error", msg);
      console.error("Create/Update PM failed:", err?.response?.data || err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pm /*, cvv */) => {
    try {
      await api.delete(`/payment-methods/${pm._id}`);
      showAlert("success", "Card removed.");
      setPmRefreshKey((k) => k + 1);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to delete the card.";
      showAlert("error", msg);
      console.error("Delete PM failed:", err?.response?.data || err);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!stripeEnabled) {
    return (
      <Alert severity="info">
        Saved card payments are not currently available. Payments recorded by
        Tipsyverse staff will still appear in your event finance history.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={700}>
        Your Payment Methods
      </Typography>

      {/* Closeable Alert */}
      <Collapse in={alert.open}>
        <Alert
          severity={alert.severity}
          onClose={closeAlert}
          sx={{ borderRadius: 2 }}
        >
          {alert.message}
        </Alert>
      </Collapse>

      <PaymentMethodList
        ownerId={user?._id}
        selected={selectedPaymentMethod}
        onChange={setSelectedPaymentMethod}
        refreshKey={pmRefreshKey}
        onAddClick={openCreate}
        onEdit={openEdit}
        onRemove={(pm) => setDeleteTarget(pm)}
      />

      <Divider />

      <div ref={formAnchorRef} />
      {showForm && (
        stripePromise ? (
          <Elements stripe={stripePromise}>
            <PaymentMethodForm
              mode={formMode}
              initialValue={editTarget}
              onSubmit={handleSubmitPM}
              onCancel={() => {
                setShowForm(false);
                setEditTarget(null);
              }}
              submitting={submitting}
            />
          </Elements>
        ) : (
          <Alert severity="warning">Card storage is not configured.</Alert>
        )
      )}

      <DeleteConfirmPaymentDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        brand={deleteTarget?.brand}
        last4={deleteTarget?.last4}
        onConfirm={(cvv) => handleDelete(deleteTarget, cvv)}
      />
    </Stack>
  );
};

export default PaymentMethodsTab;
