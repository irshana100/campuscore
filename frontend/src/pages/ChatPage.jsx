import ChatWidget from '../components/ChatWidget';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">College AI Assistant</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Ask anything about campus life</h1>
          </div>
        </div>
        <ChatWidget embedded defaultOpen />
      </div>
    </div>
  );
}
