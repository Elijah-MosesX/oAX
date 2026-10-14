export type Role = 'owner' | 'contributor' | 'reader';
export interface Principal {
  userId: string;
  name?: string;
  email?: string;
  scope: string;
}
export interface Room {
  repository: string;
  owner: string;
  createdAt: string;
}
export interface Access {
  roomId: string;
  owner: string;
  role: Role;
}
export class Denied extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function bounded(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Denied(400, `Invalid ${name}`);
  return value.trim();
}
export function identifier(value: unknown): string {
  const id = bounded(value, 'identifier', 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Denied(400, 'Invalid identifier');
  return id;
}
export function repositoryName(value: unknown): string {
  const repository = bounded(value, 'repository', 200);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository)
  )
    throw new Denied(400, 'Use owner/repository');
  return repository;
}
export function checkAccess(
  roomId: string,
  room: Room | null,
  user: Principal,
  invite?: Access,
): Role {
  if (!room) throw new Denied(404, 'Room unavailable');
  if (room.owner === user.userId) return 'owner';
  if (
    !invite ||
    invite.roomId !== roomId ||
    invite.owner !== room.owner ||
    !['reader', 'contributor'].includes(invite.role)
  )
    throw new Denied(403, 'A current invitation for this room is required');
  return invite.role;
}
export function mayWrite(role: Role): void {
  if (role === 'reader') throw new Denied(403, 'Reader access cannot publish');
}
export function mayRetract(role: Role, author: string, user: Principal): void {
  if (role !== 'owner' && (role !== 'contributor' || author !== user.userId))
    throw new Denied(
      403,
      'Only the author or room owner can retract this entry',
    );
}
export function noteInput(input: Record<string, unknown>) {
  const kind = bounded(input.kind, 'entry type', 20);
  if (!['finding', 'question', 'decision'].includes(kind))
    throw new Denied(400, 'Invalid entry type');
  const title = bounded(input.title, 'title', 160);
  const text = bounded(input.text, 'text', 8000);
  const path = typeof input.path === 'string' ? input.path.trim() : '';
  if (
    path.length > 512 ||
    path.startsWith('/') ||
    /(^|[\\/])\.\.([\\/]|$)|:|\x00/.test(path)
  )
    throw new Denied(400, 'Use a workspace-relative code reference');
  return { kind, title, text, path };
}
