export function getLastSeenTimestamp(
  updatedAt: string | null | undefined,
  createdAt: string
) {
  if (updatedAt && !Number.isNaN(Date.parse(updatedAt))) {
    return updatedAt;
  }

  return createdAt;
}

export function formatLastSeen(dateString: string, now = new Date()) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
