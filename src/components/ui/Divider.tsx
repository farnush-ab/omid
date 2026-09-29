export function Divider({ vertical = true }: { readonly vertical?: boolean }) {
  return vertical ? (
    <span className="mx-1 h-5 w-px shrink-0 bg-line" />
  ) : (
    <span className="my-1 h-px w-6 bg-line" />
  );
}
