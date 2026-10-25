export function taskCountLabel(count: number): string {
  if (count === 0) {
    return 'Nenhuma tarefa';
  }
  return count === 1 ? '1 tarefa' : `${count} tarefas`;
}
