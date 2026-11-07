import {
  getLandingContent,
  LANDING_DEFAULTS,
  LANDING_FIELD_DEFINITIONS,
} from "@/lib/landing-content";
import {
  AdminExternalLink,
  AdminPageHeader,
  adminPageShell,
} from "../_components/admin-ui";
import { AdminLandingClient } from "./landing-client";

export default async function AdminLandingPage() {
  const content = await getLandingContent();

  const fields = LANDING_FIELD_DEFINITIONS.map((field) => ({
    ...field,
    currentValue: content[field.key],
    defaultValue: LANDING_DEFAULTS[field.key],
  }));

  return (
    <div className={adminPageShell}>
      <AdminPageHeader
        eyebrow="Admin / Web pública"
        title="Editor de landing"
        description="Los cambios se reflejan en la web pública en segundos."
        actions={<AdminExternalLink href="/">Ver landing</AdminExternalLink>}
      />

      <AdminLandingClient fields={fields} />
    </div>
  );
}
