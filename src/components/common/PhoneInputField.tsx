import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import "./PhoneInputField.css";

// Wraps react-phone-number-input (country dropdown with flag + dial code, plus
// a national-number field) so every phone number captured going forward is
// stored in proper E.164 format (e.g. "+14155550123"). WhatsApp's API requires
// E.164 for the `to` field, and the app's own session-window/thread-matching
// logic compares numbers as strings — this is the single place new numbers
// should be entered so that requirement doesn't quietly get skipped again.
export function PhoneInputField({
  id,
  value,
  onChange,
  placeholder = "Phone number",
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <PhoneInput
      id={id}
      international
      defaultCountry="US"
      flags={flags}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      placeholder={placeholder}
      disabled={disabled}
      className="phone-input-field"
      numberInputProps={{ className: "PhoneInputInput" }}
    />
  );
}
