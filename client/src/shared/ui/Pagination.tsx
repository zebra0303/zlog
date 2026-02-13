import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <nav aria-label="페이지네이션" className="flex items-center justify-center gap-1">
      <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="이전 페이지"><ChevronLeft className="h-4 w-4" /></Button>
      {pages.map((page, i) => page === "..." ? <span key={`e-${i}`} className="px-2 text-[var(--color-text-secondary)]">...</span> : (
        <Button key={page} variant={page === currentPage ? "default" : "outline"} size="icon" onClick={() => onPageChange(page)} aria-current={page === currentPage ? "page" : undefined}>{page}</Button>
      ))}
      <Button variant="outline" size="icon" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="다음 페이지"><ChevronRight className="h-4 w-4" /></Button>
    </nav>
  );
}
