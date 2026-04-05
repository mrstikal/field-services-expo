import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color="#1e40af" />
        </View>
        <Text style={styles.name}>{user?.profile.name || 'Technician'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user?.profile.phone || 'Not set'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{user?.role === 'technician' ? 'Technician' : 'Dispatcher'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>Field Service v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  avatarContainer: {
    marginBottom: 16,
  },
  container: {
    backgroundColor: '#f9fafb',
    flex: 1,
  },
  email: {
    color: '#6b7280',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 2,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  infoValue: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  name: {
    color: '#1f2937',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 12,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionText: {
    color: '#9ca3af',
    fontSize: 12,
  },
});
