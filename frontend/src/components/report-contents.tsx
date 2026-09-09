import { SectionNavigation } from "@gitnapp/ui/components/ui/section-navigation";
export function ReportContents({
  sections,
  active,
}: {
  sections: { title: string }[];
  active: string;
}) {
  return (
    <SectionNavigation
      active={active}
      items={[
        ...sections.map((s, i) => ({ title: s.title, id: `section-${i}` })),
        { title: "来源索引", id: "report-sources" },
      ]}
    />
  );
}
