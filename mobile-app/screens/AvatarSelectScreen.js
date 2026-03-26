import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LAN_IP, getApiUrl } from '../../shared/config/constants';
import { getAvatars, getFollows, getFollowerCounts, getBroadcasts } from '../../shared/services/api';
import { followAvatar, unfollowAvatar, deleteCustomAvatar } from '../../shared/services/api';

/**
 * AvatarSelectScreen — Fetches ALL avatars from backend API (single source of truth).
 * No more AsyncStorage for custom avatars.
 */
export default function AvatarSelectScreen({ navigation }) {
  const [userId, setUserId] = useState('');
  const [allAvatars, setAllAvatars] = useState([]);
  const [followedAvatars, setFollowedAvatars] = useState([]);
  const [followerCounts, setFollowerCountsState] = useState({});
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initUser();
  }, []);

  // Reload avatars every time screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchAvatars();
    }, [])
  );

  async function initUser() {
    try {
      let uid = await AsyncStorage.getItem('user_id');
      if (!uid) {
        uid = 'mobile_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await AsyncStorage.setItem('user_id', uid);
      }
      setUserId(uid);
      await Promise.all([fetchAvatars(), loadData(uid)]);
    } catch (e) {
      console.warn('Init error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvatars() {
    const apiUrl = getApiUrl();
    console.log('[Mobile] Fetching avatars from:', `${apiUrl}/api/avatars`);
    try {
      const res = await getAvatars();
      console.log('[Mobile] getAvatars response:', JSON.stringify(res).substring(0, 200));
      if (res.success && res.data?.avatars) {
        console.log('[Mobile] Loaded', res.data.avatars.length, 'avatars');
        setAllAvatars(res.data.avatars);
      } else {
        console.warn('[Mobile] getAvatars failed, trying direct fetch. Error:', res.error);
        // Fallback: direct fetch
        try {
          const directRes = await fetch(`${apiUrl}/api/avatars`);
          const directData = await directRes.json();
          console.log('[Mobile] Direct fetch result:', JSON.stringify(directData).substring(0, 200));
          if (directData.avatars) {
            setAllAvatars(directData.avatars);
          }
        } catch (fetchErr) {
          console.error('[Mobile] Direct fetch also failed:', fetchErr.message);
        }
      }
    } catch (e) {
      console.error('[Mobile] fetchAvatars exception:', e.message);
    }
  }

  async function loadData(uid) {
    const [followsRes, countsRes, broadcastsRes] = await Promise.all([
      getFollows(uid || userId),
      getFollowerCounts(),
      getBroadcasts(),
    ]);
    if (followsRes.success) setFollowedAvatars(followsRes.data.followedAvatars || []);
    if (countsRes.success) setFollowerCountsState(countsRes.data || {});
    if (broadcastsRes.success) setBroadcasts(broadcastsRes.data.broadcasts || []);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchAvatars(), loadData()]);
    setRefreshing(false);
  }

  async function handleFollow(avatarId) {
    const res = await followAvatar(userId, avatarId);
    if (res.success) {
      setFollowedAvatars(res.data.followedAvatars || []);
      const countsRes = await getFollowerCounts();
      if (countsRes.success) setFollowerCountsState(countsRes.data || {});
    } else {
      Alert.alert('Error', res.error || 'Could not follow');
    }
  }

  async function handleUnfollow(avatarId) {
    const res = await unfollowAvatar(userId, avatarId);
    if (res.success) {
      setFollowedAvatars(res.data.followedAvatars || []);
      const countsRes = await getFollowerCounts();
      if (countsRes.success) setFollowerCountsState(countsRes.data || {});
    } else {
      Alert.alert('Error', res.error || 'Could not unfollow');
    }
  }

  async function handleDelete(avatarId) {
    console.log('[Mobile] Deleting avatar:', avatarId);
    const res = await deleteCustomAvatar(avatarId);
    if (res.success) {
      await fetchAvatars(); // Auto-refresh
    } else {
      Alert.alert('Error', res.error || 'Could not delete avatar');
    }
  }

  function openAvatar(avatar) {
    navigation.navigate('AvatarCall', {
      avatar: {
        ...avatar,
        avatarGender: avatar.avatarGender || avatar.gender || avatar.voice || 'male',
      },
      userId,
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7A00" />
        <Text style={styles.loadingText}>Connecting to server…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF7A00" />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Choose an AI Assistant</Text>
        <Text style={styles.heroSub}>Tap to start conversation</Text>
      </View>

      {/* Create New Avatar Button */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => navigation.navigate('CreateAvatar')}
        activeOpacity={0.8}
      >
        <Text style={styles.createBtnEmoji}>➕</Text>
        <View>
          <Text style={styles.createBtnText}>Create New Avatar</Text>
          <Text style={styles.createBtnSub}>Design your own AI assistant</Text>
        </View>
      </TouchableOpacity>

      {/* Followed Section */}
      {followedAvatars.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ Following</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {allAvatars.filter(a => followedAvatars.includes(a.id)).map(avatar => (
              <TouchableOpacity key={avatar.id} style={styles.followedChip} onPress={() => openAvatar(avatar)}>
                <Text style={styles.followedEmoji}>{avatar.emoji || (avatar.gender === 'female' ? '👩' : '👨')}</Text>
                <Text style={styles.followedName}>{avatar.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Avatar Grid */}
      <View style={styles.grid}>
        {allAvatars.map(avatar => {
          const isFollowed = followedAvatars.includes(avatar.id);
          const fCount = followerCounts[avatar.id] || 0;
          return (
            <TouchableOpacity key={avatar.id} style={styles.card} onPress={() => openAvatar(avatar)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <View style={[styles.avatarCircle, avatar.type === 'custom' && styles.customAvatarCircle]}>
                  <Text style={styles.avatarEmoji}>{avatar.emoji || '🤖'}</Text>
                </View>
                {avatar.type === 'custom' ? (
                  <View style={styles.customBadge}>
                    <Text style={styles.customBadgeText}>Custom</Text>
                  </View>
                ) : fCount > 0 ? (
                  <View style={styles.followerBadge}>
                    <Text style={styles.followerBadgeText}>👥 {fCount}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardName}>{avatar.name}</Text>
                {avatar.verified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>✔ Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{avatar.title}</Text>

              <View style={styles.cardActions}>
                {avatar.type !== 'custom' && (
                  <TouchableOpacity
                    style={[styles.followBtn, isFollowed && styles.followBtnActive]}
                    onPress={() => { isFollowed ? handleUnfollow(avatar.id) : handleFollow(avatar.id); }}
                  >
                    <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                      {isFollowed ? '✓ Following' : '+ Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.chatBtn, avatar.type === 'custom' && { flex: 1 }]} onPress={() => openAvatar(avatar)}>
                  <Text style={styles.chatBtnText}>Chat →</Text>
                </TouchableOpacity>
                {avatar.type === 'custom' && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      Alert.alert('Delete Avatar', `Delete "${avatar.name}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(avatar.id) },
                      ]);
                    }}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Empty State for Custom Avatars */}
      {!allAvatars.some(a => a.type === 'custom') && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🤖</Text>
          <Text style={styles.emptyText}>No custom avatars yet</Text>
          <Text style={styles.emptySub}>Tap "Create New Avatar" above to get started</Text>
        </View>
      )}

      {/* Broadcasts */}
      {broadcasts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📺 Recent Broadcasts</Text>
          {broadcasts.slice(0, 5).map(bc => {
            const avatar = allAvatars.find(a => a.id === bc.avatarId);
            return (
              <TouchableOpacity key={bc.id} style={styles.broadcastItem} onPress={() => {
                if (avatar) {
                  navigation.navigate('AvatarCall', {
                    avatar,
                    userId,
                    broadcast: bc,
                  });
                }
              }}>
                <Text style={styles.broadcastIcon}>📢</Text>
                <View style={styles.broadcastBody}>
                  <Text style={styles.broadcastTitle}>
                    <Text style={{ fontWeight: '700' }}>{avatar?.name || bc.avatarId}</Text> — {bc.title}
                  </Text>
                  <Text style={styles.broadcastMsg} numberOfLines={2}>{bc.message}</Text>
                  <Text style={styles.broadcastTime}>{new Date(bc.timestamp).toLocaleString()}</Text>
                </View>
                <Text style={styles.broadcastWatch}>▶</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Server IP info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Server: {LAN_IP}:4000</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f23' },
  loadingText: { color: '#9CA3AF', marginTop: 12, fontSize: 14 },

  hero: { alignItems: 'center', paddingVertical: 24 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 20, padding: 16,
    backgroundColor: 'rgba(255,122,0,0.08)', borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,122,0,0.3)',
    borderStyle: 'dashed',
  },
  createBtnEmoji: { fontSize: 28 },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#FF7A00' },
  createBtnSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },

  followedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,122,0,0.1)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,122,0,0.3)',
  },
  followedEmoji: { fontSize: 18 },
  followedName: { fontSize: 13, fontWeight: '600', color: '#FF7A00' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 12, gap: 12 },
  card: {
    width: '45%', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', elevation: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,122,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  customAvatarCircle: {
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  avatarEmoji: { fontSize: 24 },
  followerBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  followerBadgeText: { fontSize: 10, color: '#9CA3AF' },
  customBadge: { backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  customBadgeText: { fontSize: 10, color: '#818CF8', fontWeight: '600' },

  cardName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  cardTitle: { fontSize: 11, color: '#9CA3AF', marginBottom: 12 },

  cardActions: { flexDirection: 'row', gap: 8 },
  followBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center',
  },
  followBtnActive: { backgroundColor: '#FF7A00', borderColor: '#FF7A00' },
  followBtnText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  followBtnTextActive: { color: '#fff' },
  chatBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,122,0,0.15)', alignItems: 'center',
  },
  chatBtnText: { fontSize: 11, fontWeight: '600', color: '#FF7A00' },

  verifiedBadge: { backgroundColor: 'rgba(29,155,240,0.12)', borderRadius: 6, paddingVertical: 1, paddingHorizontal: 6 },
  verifiedBadgeText: { fontSize: 9, color: '#1D9BF0', fontWeight: '700' },

  deleteBtn: {
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: 'rgba(198,40,40,0.12)', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32, marginTop: 4 },
  emptyEmoji: { fontSize: 36, marginBottom: 8, opacity: 0.5 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  emptySub: { fontSize: 11, color: '#4B5563', marginTop: 4, textAlign: 'center' },

  broadcastItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  broadcastIcon: { fontSize: 22, marginTop: 2 },
  broadcastBody: { flex: 1 },
  broadcastTitle: { fontSize: 13, color: '#fff', lineHeight: 18 },
  broadcastMsg: { fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 16 },
  broadcastTime: { fontSize: 10, color: '#4B5563', marginTop: 4 },
  broadcastWatch: { fontSize: 20, color: '#FF7A00', marginTop: 4 },

  footer: { alignItems: 'center', paddingVertical: 20 },
  footerText: { fontSize: 10, color: '#4B5563' },
});
