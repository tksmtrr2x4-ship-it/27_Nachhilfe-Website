import SubjectPage from "@/components/SubjectPage";
import { pageMetadata } from "@/lib/seo";
import { getSubject } from "@/lib/subjects";

const subject = getSubject("biologie");

export const metadata = pageMetadata({
  path: subject.path,
  title: subject.title,
  description: subject.description,
});

export default function Page() {
  return <SubjectPage subject={subject} />;
}
