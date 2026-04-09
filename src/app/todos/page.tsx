import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="flex-1 overflow-auto p-8 relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-[#FBFBFB] [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#F1F5F9_100%)]" />

      <div className="mx-auto max-w-2xl space-y-6">
        <header className="mb-8 flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Todo List ⚡
          </h1>
          <p className="text-sm font-medium text-slate-500">
            A server-side fetched list from your Supabase database.
          </p>
        </header>

        <div className="glass p-6 rounded-2xl border border-border bg-card shadow-sm">
          {todos && todos.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {todos.map((todo) => (
                <li key={todo.id} className="py-3 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[#00FFC2]" />
                  <span className="text-sm font-semibold text-slate-700">{todo.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">No todos found</h3>
              <p className="text-slate-500 mt-2 font-medium text-xs">Create a 'todos' table in Supabase to see real data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
