import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import PaperView from "./PaperView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PaperPage({ params }: Props) {
  const { id } = await params;
  const paper = await prisma.paper.findUnique({ where: { id } });

  if (!paper) {
    notFound();
  }

  return <PaperView paper={paper} />;
}
