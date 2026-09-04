const interactionMotionStyleId = "hydra-interaction-motion-runtime";

const interactionMotionCss = String.raw`
@media (prefers-reduced-motion: no-preference) {
  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button {
    transition: color .2s ease, transform .18s ease !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button > span:first-of-type:not(.touch-ripple) {
    transition: transform .22s cubic-bezier(.2,.8,.2,1), background-color .2s ease, box-shadow .2s ease !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button:active > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.is-tapped > span:first-of-type:not(.touch-ripple) {
    transform: scale(.88) !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc) > span:first-of-type:not(.touch-ripple) {
    animation: hydra-nav-active-pop .28s cubic-bezier(.2,.9,.25,1.25) both !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.active:not(.nav-nfc)::after {
    animation: hydra-nav-dot-in .24s cubic-bezier(.2,.9,.25,1.2) both !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc > span:first-of-type:not(.touch-ripple) {
    transition: transform .24s cubic-bezier(.2,.8,.2,1), box-shadow .24s ease !important;
  }

  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc:active > span:first-of-type:not(.touch-ripple),
  html body #root .hydra-root .phone-app nav.bottom-nav.bottom-nav > button.nav-nfc.nav-nfc.is-tapped > span:first-of-type:not(.touch-ripple) {
    transform: translateX(-50%) scale(.91) !important;
    box-shadow: 0 3px 9px rgba(23, 76, 54, .14) !important;
  }

  html body #root .hydra-root .login-code-input,
  html body #root .hydra-root .staff-code-input,
  html body #root .hydra-root input[autocomplete="one-time-code"] {
    transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease, background-color .2s ease !important;
    animation: hydra-code-field-in .3s cubic-bezier(.2,.8,.2,1) both;
  }

  html body #root .hydra-root .login-code-input:focus,
  html body #root .hydra-root .staff-code-input:focus,
  html body #root .hydra-root input[autocomplete="one-time-code"]:focus {
    transform: translateY(-1px) scale(1.01) !important;
    box-shadow: 0 0 0 3px rgba(23,76,54,.12), 0 7px 18px rgba(23,76,54,.08) !important;
  }

  html body #root .hydra-root .auth-content:has(.login-code-input),
  html body #root .hydra-root .auth-content:has(.staff-code-input),
  html body #root .hydra-root .signup-panel:has(.login-code-input) {
    animation: hydra-code-screen-in .32s cubic-bezier(.2,.8,.2,1) both !important;
  }

  html body #root .hydra-root .form-error {
    animation: hydra-code-error .28s ease both;
  }

  html body #root .hydra-root .form-notice {
    animation: hydra-code-success .3s cubic-bezier(.2,.8,.2,1) both;
  }
}

@keyframes hydra-nav-active-pop {
  0% { transform: scale(.9); }
  55% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes hydra-nav-dot-in {
  0% { opacity: 0; transform: translateX(-50%) scale(.2); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}

@keyframes hydra-code-field-in {
  0% { opacity: 0; transform: translateY(8px) scale(.985); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes hydra-code-screen-in {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes hydra-code-error {
  0%, 100% { transform: translateX(0); opacity: 1; }
  30% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
}

@keyframes hydra-code-success {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;

const previousInteractionMotionStyle = document.getElementById(interactionMotionStyleId);
if (previousInteractionMotionStyle) previousInteractionMotionStyle.remove();
const interactionMotionStyle = document.createElement("style");
interactionMotionStyle.id = interactionMotionStyleId;
interactionMotionStyle.textContent = interactionMotionCss;
document.head.appendChild(interactionMotionStyle);

export {};
