const styleId = "hydra-admin-user-management-polish";

const css = String.raw`
.admin-user-detail {
  display: grid !important;
  gap: 14px !important;
  padding-bottom: 6px !important;
}

.admin-user-detail .admin-user-identity {
  position: relative !important;
  overflow: hidden !important;
  padding: 18px !important;
  gap: 13px !important;
  border: 0 !important;
  border-radius: 24px !important;
  background: linear-gradient(135deg, #0f3022 0%, #174c36 68%, #256348 100%) !important;
  box-shadow: 0 16px 36px rgba(15,55,39,.2) !important;
}

.admin-user-detail .admin-user-identity::after {
  content: "" !important;
  position: absolute !important;
  width: 128px !important;
  height: 128px !important;
  right: -48px !important;
  top: -62px !important;
  border-radius: 50% !important;
  background: rgba(255,255,255,.075) !important;
  pointer-events: none !important;
}

.admin-user-detail .admin-user-identity > span {
  width: 54px !important;
  min-width: 54px !important;
  height: 54px !important;
  min-height: 54px !important;
  border-radius: 18px !important;
  background: rgba(255,255,255,.13) !important;
  color: #fff !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.12) !important;
  font-size: 13px !important;
  font-weight: 900 !important;
}

.admin-user-detail .admin-user-identity strong {
  color: #fff !important;
  font-size: 12px !important;
  font-weight: 850 !important;
}

.admin-user-detail .admin-user-identity small {
  color: rgba(255,255,255,.66) !important;
  font-size: 9px !important;
  line-height: 1.4 !important;
}

.admin-user-detail .admin-runtime-details {
  display: grid !important;
  gap: 11px !important;
}

.admin-user-detail .admin-user-statusline {
  min-height: 43px !important;
  padding: 11px 13px !important;
  border: 1px solid #dce9df !important;
  border-radius: 15px !important;
  background: linear-gradient(135deg,#edf6f0,#f8fbf9) !important;
  box-shadow: 0 5px 15px rgba(17,43,32,.035) !important;
}

.admin-user-detail .admin-user-statusline span {
  font-size: 8px !important;
  font-weight: 800 !important;
  letter-spacing: .055em !important;
  text-transform: uppercase !important;
  color: #7b8981 !important;
}

.admin-user-detail .admin-user-statusline strong {
  font-size: 10px !important;
  color: #174c36 !important;
}

.admin-user-detail .admin-user-statusline.is-blocked {
  background: linear-gradient(135deg,#fff0ee,#fff8f7) !important;
  border-color: #f0d1cd !important;
}

.admin-user-detail .admin-user-summary-grid {
  display: grid !important;
  grid-template-columns: repeat(2,minmax(0,1fr)) !important;
  gap: 8px !important;
}

.admin-user-detail .admin-user-summary-grid article {
  min-height: 68px !important;
  padding: 11px !important;
  border: 1px solid #e5ebe7 !important;
  border-radius: 15px !important;
  background: linear-gradient(145deg,#fff,#fbfcfb) !important;
  box-shadow: 0 6px 18px rgba(17,43,32,.035) !important;
}

.admin-user-detail .admin-user-summary-grid small {
  display: block !important;
  margin-bottom: 5px !important;
  color: #8a958f !important;
  font-size: 7px !important;
  font-weight: 850 !important;
  letter-spacing: .055em !important;
  text-transform: uppercase !important;
}

.admin-user-detail .admin-user-summary-grid strong {
  color: #173c2d !important;
  font-size: 9.5px !important;
  line-height: 1.35 !important;
}

.admin-user-detail .admin-user-usage {
  display: grid !important;
  grid-template-columns: repeat(4,minmax(0,1fr)) !important;
  gap: 7px !important;
  padding: 12px !important;
  border-radius: 18px !important;
  background: linear-gradient(135deg,#123e2d,#1a573d) !important;
  box-shadow: 0 11px 25px rgba(18,62,45,.15) !important;
}

.admin-user-detail .admin-user-usage > div {
  padding: 8px 4px !important;
  border-radius: 11px !important;
  background: rgba(255,255,255,.055) !important;
}

.admin-user-detail .admin-user-usage strong {
  color: #fff !important;
  font-size: 16px !important;
  line-height: 1 !important;
}

.admin-user-detail .admin-user-usage small {
  margin-top: 4px !important;
  color: rgba(255,255,255,.67) !important;
  font-size: 7px !important;
}

.admin-user-detail > .field {
  padding: 13px !important;
  border: 1px solid #e2e9e4 !important;
  border-radius: 17px !important;
  background: linear-gradient(145deg,#fbfcfb,#f7faf8) !important;
  box-shadow: 0 6px 16px rgba(17,43,32,.025) !important;
}

.admin-user-detail > .field > label,
.admin-user-detail > .field > span,
.admin-user-detail > .field > small {
  font-size: 8.5px !important;
  font-weight: 800 !important;
  color: #52695d !important;
}

.admin-user-detail select,
.admin-user-detail textarea,
.admin-user-detail input {
  border-radius: 13px !important;
  border-color: #dfe7e2 !important;
  background: #fff !important;
}

.admin-user-detail textarea {
  min-height: 84px !important;
}

.admin-user-detail > .danger-button.full,
.admin-user-detail > .secondary-button.full {
  min-height: 44px !important;
  border-radius: 14px !important;
  font-size: 9.5px !important;
  font-weight: 850 !important;
  box-shadow: none !important;
}

.admin-user-detail .admin-notification-form {
  padding: 15px !important;
  border: 1px solid #e1e8e3 !important;
  border-radius: 19px !important;
  background: linear-gradient(145deg,#fcfdfc,#f5f8f6) !important;
  box-shadow: 0 8px 20px rgba(17,43,32,.035) !important;
}

.admin-user-detail .admin-notification-form h3 {
  margin: 0 0 12px !important;
  padding-bottom: 10px !important;
  border-bottom: 1px solid #e5ebe7 !important;
  color: #173c2d !important;
  font-size: 10.5px !important;
  font-weight: 850 !important;
}

.admin-user-detail .admin-notification-form .modal-action-row {
  gap: 8px !important;
  margin-top: 12px !important;
}

.admin-user-detail .admin-notification-form .modal-action-row button {
  min-height: 42px !important;
  border-radius: 13px !important;
  font-size: 9px !important;
}

.admin-user-detail .admin-danger-zone {
  margin-top: 2px !important;
  padding: 15px !important;
  border: 1px solid #efd1cd !important;
  border-radius: 19px !important;
  background: linear-gradient(145deg,#fff9f8,#fff0ee) !important;
}

.admin-user-detail .admin-danger-zone h4 {
  margin: 0 0 4px !important;
  color: #a8423a !important;
  font-size: 11px !important;
  font-weight: 900 !important;
}

.admin-user-detail .admin-danger-zone p {
  margin: 0 0 11px !important;
  color: #8d6a66 !important;
  font-size: 8.5px !important;
  line-height: 1.45 !important;
}

.admin-user-detail .admin-delete-account {
  min-height: 43px !important;
  border: 1px solid rgba(183,71,62,.18) !important;
  border-radius: 13px !important;
  background: #fff !important;
  color: #a53e37 !important;
  font-size: 9.5px !important;
  font-weight: 900 !important;
  box-shadow: 0 6px 16px rgba(183,71,62,.07) !important;
}

@media (max-width: 420px) {
  .admin-user-detail .admin-user-summary-grid {
    grid-template-columns: 1fr !important;
  }
  .admin-user-detail .admin-user-usage {
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
  }
}
`;

const previous = document.getElementById(styleId);
if (previous) previous.remove();
const style = document.createElement("style");
style.id = styleId;
style.textContent = css;
document.head.appendChild(style);
