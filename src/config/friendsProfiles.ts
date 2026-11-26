import friendsProfilesData from '../../content/friends-profiles.json';
import { i18n } from '../i18n/LocalizationManager';

export type FriendMemberId = 'david' | 'mor' | 'lior';

export interface FriendProfileConfig {
  id: FriendMemberId;
  nameEn: string;
  nameHe: string;
  bubbleColor: string;
  avatarInitialEn: string;
  avatarInitialHe: string;
  notes: string;
}

export interface FriendsGroupConfig {
  groupNameEn: string;
  groupNameHe: string;
  members: FriendProfileConfig[];
}

export const FRIENDS_GROUP_CONFIG = friendsProfilesData as FriendsGroupConfig;

const PROFILE_BY_ID = new Map<FriendMemberId, FriendProfileConfig>(
  FRIENDS_GROUP_CONFIG.members.map((member) => [member.id, member]),
);

export function getFriendProfile(id: FriendMemberId): FriendProfileConfig | undefined {
  return PROFILE_BY_ID.get(id);
}

export function getFriendDisplayName(id: FriendMemberId): string {
  const profile = PROFILE_BY_ID.get(id);
  if (!profile) return id;
  return i18n.getLanguage() === 'he' ? profile.nameHe : profile.nameEn;
}
