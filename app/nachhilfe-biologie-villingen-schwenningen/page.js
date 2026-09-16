import SubjectPage from "@/components/SubjectPage";
import { getSettings } from "@/lib/db";
import { resolveBusiness } from "@/lib/business";
import { pageMetadata } from "@/lib/seo";
import { getSubject } from "@/lib/subjects";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, serviceSchema } from "@/lib/structuredData";

const subject = getSubject("biologie");

export const metadata = pageMetadata({
  path: subject.path,
  title: subject.title,
  description: subject.description,
});

export default async function Page() {
  const settings = await getSettings();
  return (
    <>
      <JsonLd
        nodes={[serviceSchema(subject, settings), breadcrumbSchema([{ name: subject.label, path: subject.path }])]}
      />
      <SubjectPage subject={subject} business={resolveBusiness(settings)} />
    </>
  );
}
