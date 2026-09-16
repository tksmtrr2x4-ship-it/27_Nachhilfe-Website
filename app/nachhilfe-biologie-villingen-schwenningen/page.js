import SubjectPage from "@/components/SubjectPage";
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

export default function Page() {
  return (
    <>
      <JsonLd
        nodes={[serviceSchema(subject), breadcrumbSchema([{ name: subject.label, path: subject.path }])]}
      />
      <SubjectPage subject={subject} />
    </>
  );
}
