import { SiteShell } from "@fundedpro/ui";
import { signupAction } from "../../lib/auth";
import { DateInput } from "./date-input";
import { PasswordFields } from "./password-fields";
import { SearchableSelect } from "./searchable-select";

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad",
  "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos",
  "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
  "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal",
  "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
  "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
] as const;

const phoneCountries = [
  { label: "United Kingdom (+44)", value: "GB:+44" },
  { label: "United States (+1)", value: "US:+1" },
  { label: "Canada (+1)", value: "CA:+1" },
  { label: "Australia (+61)", value: "AU:+61" },
  { label: "Germany (+49)", value: "DE:+49" },
  { label: "France (+33)", value: "FR:+33" },
  { label: "Spain (+34)", value: "ES:+34" },
  { label: "Italy (+39)", value: "IT:+39" },
  { label: "Netherlands (+31)", value: "NL:+31" },
  { label: "United Arab Emirates (+971)", value: "AE:+971" },
  { label: "India (+91)", value: "IN:+91" },
  { label: "South Africa (+27)", value: "ZA:+27" }
];

const fieldLabels: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  title: "Title",
  dateOfBirth: "Date of birth",
  country: "Country",
  email: "Email",
  phoneCountry: "Phone country",
  phoneNumber: "Phone number",
  password: "Password",
  confirmPassword: "Confirm password"
};

const signupErrorMessages: Record<string, string> = {
  "invalid-fields": "Please fill out all required fields correctly.",
  "missing-field": "Please fill out the required field.",
  "invalid-field": "Please correct the field.",
  "password-mismatch": "Passwords do not match.",
  "under-16": "You must be at least 16 years old to create an account.",
  "invalid-phone": "Please enter a valid phone number.",
  "email-exists": "An account with that email already exists.",
  "verification-expired": "Your verification email expired after 10 minutes. You can sign up again now.",
  "google-unavailable": "Google sign-in is not configured yet.",
  "google-failed": "Google sign-in could not be completed. Please try again.",
  "signup-failed": "We could not create your account. Please try again."
};

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    dateOfBirth?: string;
    country?: string;
    email?: string;
    phoneCountry?: string;
    phoneNumber?: string;
    referralCode?: string;
    field?: string;
  }>;
};

function getSignupErrorMessage(error: string | undefined, field: string | undefined) {
  if (!error) {
    return null;
  }

  if (error === "missing-field" && field) {
    return `Please fill out ${fieldLabels[field] ?? "this field"}.`;
  }

  if (error === "invalid-field" && field) {
    if (field === "email") return "Enter a valid email address.";
    if (field === "firstName") return "Enter your first name.";
    if (field === "lastName") return "Enter your last name.";
    if (field === "title") return "Select your title.";
    if (field === "country") return "Select your country.";
    if (field === "phoneCountry") return "Select your phone country.";
    if (field === "password") return "Password must be at least 8 characters.";
    if (field === "confirmPassword") return "Confirm password must be at least 8 characters.";
    if (field === "dateOfBirth") return "Enter your date of birth in dd/mm/yyyy format.";
    if (field === "phoneNumber") return "Enter a valid phone number.";
    return "Correct the highlighted field.";
  }

  if (error === "password-mismatch") {
    return "Passwords do not match.";
  }

  if (error === "invalid-phone") {
    return "Enter a valid phone number.";
  }

  if (error === "under-16") {
    return "You must be at least 16 years old to create an account.";
  }

  return signupErrorMessages[error] ?? "Please check your form and try again.";
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const values = await searchParams;
  const { error, field } = values;
  const errorMessage = getSignupErrorMessage(error, field);
  const hasFieldError = (name: string) => field === name;

  return (
    <SiteShell>
      <main className="signup-page">
        <section className="signup-shell">
          <div className="signup-header">
            <h1 className="signup-title">Create your account</h1>
          </div>

          {errorMessage ? <p className="signup-error">{errorMessage}</p> : null}

          <form action={signupAction} className="signup-form">
            <div className="signup-two-up">
              <label className="signup-field">
                <span>First name</span>
                <input
                  name="firstName"
                  type="text"
                  defaultValue={values.firstName ?? ""}
                  required
                  className={hasFieldError("firstName") ? "signup-input-error" : ""}
                />
              </label>
              <label className="signup-field">
                <span>Last name</span>
                <input
                  name="lastName"
                  type="text"
                  defaultValue={values.lastName ?? ""}
                  required
                  className={hasFieldError("lastName") ? "signup-input-error" : ""}
                />
              </label>
            </div>

            <div className="signup-two-up">
              <label className="signup-field">
                <span>Title</span>
                <select
                  name="title"
                  defaultValue={values.title ?? ""}
                  className={hasFieldError("title") ? "signup-input-error" : ""}
                >
                  <option value="" disabled>Select title</option>
                  <option>Mr</option>
                  <option>Mrs</option>
                  <option>Ms</option>
                  <option>Miss</option>
                  <option>Dr</option>
                </select>
              </label>
              <label className="signup-field">
                <span>Date of Birth</span>
                <DateInput
                  name="dateOfBirth"
                  defaultValue={values.dateOfBirth ?? ""}
                  hasError={hasFieldError("dateOfBirth")}
                />
              </label>
            </div>

            <label className="signup-field">
              <span>Country</span>
              <SearchableSelect
                name="country"
                options={countries.map((country) => ({ label: country, value: country }))}
                placeholder="Select a country"
                searchPlaceholder="Search countries..."
                defaultValue={values.country ?? ""}
                hasError={hasFieldError("country")}
              />
            </label>

            <label className="signup-field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                defaultValue={values.email ?? ""}
                required
                className={hasFieldError("email") ? "signup-input-error" : ""}
              />
            </label>

            <div className="signup-phone-group">
              <label className="signup-field">
                <span>Phone number</span>
                <SearchableSelect
                  name="phoneCountry"
                  options={phoneCountries}
                  placeholder="Select country"
                  searchPlaceholder="Search country codes..."
                  defaultValue={values.phoneCountry ?? ""}
                  hasError={hasFieldError("phoneCountry")}
                />
              </label>
              <label className="signup-field signup-field-phone-input">
                <span className="signup-field-spacer">Phone</span>
                <input
                  name="phoneNumber"
                  type="tel"
                  placeholder="Phone number"
                  defaultValue={values.phoneNumber ?? ""}
                  className={hasFieldError("phoneNumber") ? "signup-input-error" : ""}
                />
              </label>
            </div>

            <PasswordFields
              passwordError={hasFieldError("password")}
              confirmPasswordError={hasFieldError("confirmPassword")}
            />

            <label className="signup-field">
              <span>
                Referral code <em>(optional)</em>
              </span>
              <input name="referralCode" type="text" defaultValue={values.referralCode ?? ""} />
            </label>

            <label className="signup-check">
              <input type="checkbox" required />
              <span>I certify that I am 18 years of age or older, agree to the User Agreement, and acknowledge the Privacy policy.</span>
            </label>
            <label className="signup-check">
              <input type="checkbox" required />
              <span>I acknowledge my name is correct and corresponds to the government-issued identification.</span>
            </label>
            <label className="signup-check">
              <input type="checkbox" />
              <span>I agree to receive news, updates, promotions, surveys, and other communications from FundedPro via phone and email.</span>
            </label>

            <button type="submit" className="signup-submit">Get Funded</button>

            <div className="signup-divider">OR</div>

            <a href="/api/auth/google" className="signup-google">
              <span>Continue with Google</span>
              <span className="signup-google-mark" aria-hidden="true">G</span>
            </a>

            <p className="signup-footer">
              Already have an account? <a href="/login">Sign in</a>
            </p>
          </form>
        </section>
      </main>
    </SiteShell>
  );
}
