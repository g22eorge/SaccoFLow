import { AppSettings } from "@/src/lib/settings";

type ExportMetadataInput = {
  settings: AppSettings;
  generatedAt: string;
  preparedBy?: string | null;
};

export const buildExportMetadata = ({
  settings,
  generatedAt,
  preparedBy,
}: ExportMetadataInput) => {
  const profile = settings.saccoProfile;
  const policy = settings.documentExportPolicy;
  const metadata: Array<[string, string]> = [];

  if (policy.showOrganizationName) {
    metadata.push(["Organization", profile.organizationName]);
  }
  if (policy.showOrganizationCode) {
    metadata.push(["Organization Code", profile.organizationCode]);
  }
  if (policy.showLogoUrl && profile.logoUrl) {
    metadata.push(["Logo", profile.logoUrl]);
  }
  if (policy.showContactPhone && profile.contactPhone) {
    metadata.push(["Contact Phone", profile.contactPhone]);
  }
  if (policy.showContactEmail && profile.contactEmail) {
    metadata.push(["Contact Email", profile.contactEmail]);
  }
  if (policy.showContactAddress && profile.contactAddress) {
    metadata.push(["Contact Address", profile.contactAddress]);
  }
  if (policy.showPreparedBy && preparedBy) {
    metadata.push(["Prepared By", preparedBy]);
  }
  if (policy.showGeneratedAt) {
    metadata.push(["Generated At", generatedAt]);
  }
  if (policy.showConfidentialityNotice && policy.confidentialityNotice.trim()) {
    metadata.push(["Confidentiality", policy.confidentialityNotice.trim()]);
  }

  return metadata;
};
