interface Props {
  text: string;
  onClear: () => void;
}

export default function DragContext({ text, onClear }: Props) {
  return (
    <div className="flex items-start gap-2 mx-3 mb-2 p-2 bg-blue-50 rounded text-xs border border-blue-200">
      <div className="flex-1 line-clamp-3 text-gray-700">
        &ldquo;{text}&rdquo;
      </div>
      <button onClick={onClear} className="text-gray-400 hover:text-gray-600 shrink-0">
        x
      </button>
    </div>
  );
}
