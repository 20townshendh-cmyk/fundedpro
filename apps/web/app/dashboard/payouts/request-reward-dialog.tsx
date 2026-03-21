"use client";

import { useState } from "react";
import { submitPayoutRequestAction } from "../../../lib/trader";

type RewardAccount = {
  id: string;
  login: string;
  state: string;
  availableProfitDollars: number;
  canRequest: boolean;
};

type RequestRewardDialogProps = {
  accounts: RewardAccount[];
};

export function RequestRewardDialog({ accounts }: RequestRewardDialogProps) {
  const eligibleAccounts = accounts.filter((account) => account.canRequest);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(eligibleAccounts[0]?.id ?? "");
  const selectedAccount = eligibleAccounts.find((account) => account.id === selectedId) ?? eligibleAccounts[0] ?? null;

  if (!accounts.length) {
    return <button type="button" className="ghost-button" disabled>Request Reward</button>;
  }

  return (
    <>
      <button type="button" className="ghost-button" onClick={() => setOpen(true)} disabled={!eligibleAccounts.length}>
        Request Reward
      </button>

      {open ? (
        <div className="payouts-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="payouts-modal" onClick={(event) => event.stopPropagation()}>
            <div className="payouts-modal-head">
              <strong>Select master account</strong>
              <button type="button" className="payouts-modal-close" onClick={() => setOpen(false)} aria-label="Close reward request dialog">×</button>
            </div>

            <div className="payouts-account-picker">
              {accounts.map((account) => (
                <label key={account.id} className={`payouts-account-option${selectedId === account.id ? " active" : ""}${account.canRequest ? "" : " disabled"}`}>
                  <input
                    type="radio"
                    name="tradingAccountIdChoice"
                    value={account.id}
                    checked={selectedId === account.id}
                    onChange={() => setSelectedId(account.id)}
                    disabled={!account.canRequest}
                  />
                  <div>
                    <strong>#{account.login}</strong>
                    <span>{account.state}</span>
                  </div>
                  <span>${account.availableProfitDollars.toFixed(0)}</span>
                </label>
              ))}
            </div>

            {selectedAccount ? (
              <form action={submitPayoutRequestAction} className="payouts-request-form">
                <input type="hidden" name="tradingAccountId" value={selectedAccount.id} />
                <label className="field-block">
                  <span className="muted-label">Amount in USD</span>
                  <input
                    className="surface-input"
                    type="number"
                    name="amountDollars"
                    min="1"
                    max={Math.max(1, Math.floor(selectedAccount.availableProfitDollars))}
                    step="1"
                    defaultValue={Math.max(1, Math.floor(selectedAccount.availableProfitDollars))}
                  />
                </label>
                <label className="field-block">
                  <span className="muted-label">Note</span>
                  <input className="surface-input" type="text" name="note" defaultValue={`Requested from ${selectedAccount.login}`} />
                </label>
                <label className="checkout-checkbox-row payouts-terms">
                  <input type="checkbox" name="rewardTermsAccepted" required />
                  <span>I confirm this reward request is accurate and I agree to the payout review terms.</span>
                </label>
                <button type="submit" className="ghost-button">Confirm Reward Request</button>
              </form>
            ) : (
              <p className="surface-copy">No master account is currently eligible for a reward request.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
