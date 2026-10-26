import { View } from 'react-native';

import {
  SearchInput,
  SegmentedControl,
  statusIcons,
  statusLabels,
  type SegmentOption,
} from '@/ui';

import {
  useTaskFilters,
  useTaskFiltersStore,
  type StatusFilter,
} from '../filters.store';

const options: SegmentOption<StatusFilter>[] = [
  { value: 'ALL', label: 'Todas' },
  ...(['PENDING', 'IN_PROGRESS', 'DONE'] as const).map((status) => ({
    value: status,
    label: statusLabels[status],
    icon: statusIcons[status],
  })),
];

export interface TaskFilterBarProps {
  scope: string;
  teamName?: string;
}

export function TaskFilterBar({ scope, teamName }: TaskFilterBarProps) {
  const filters = useTaskFilters(scope);
  const setStatus = useTaskFiltersStore((state) => state.setStatus);
  const setSearch = useTaskFiltersStore((state) => state.setSearch);
  return (
    <View className="gap-3">
      <SearchInput
        value={filters.search}
        onChangeText={(value) => setSearch(scope, value)}
        placeholder={teamName ? `Buscar em ${teamName}` : 'Buscar tarefas'}
      />
      <SegmentedControl
        testID="status-filter"
        label="Filtrar por status"
        options={options}
        value={filters.status}
        onChange={(status) => setStatus(scope, status)}
        scrollable
      />
    </View>
  );
}
