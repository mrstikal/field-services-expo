 
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth-context';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'technik1@demo.cz',
      password: 'demo123',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await signIn(data.email, data.password);
      router.replace('/(tabs)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#f1f5f9', padding: 20 }}>
      <Text style={{ marginBottom: 8, textAlign: 'center', fontSize: 36, fontWeight: '700', color: '#1e40af' }}>
        Field Service
      </Text>
      <Text style={{ marginBottom: 32, textAlign: 'center', fontSize: 16, color: '#6b7280' }}>
        Technician Login
      </Text>

      {error ? <Text style={{ marginBottom: 12, textAlign: 'center', color: '#ef4444' }}>{error}</Text> : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Email"
            testID="login-email-input"
            style={{
              marginBottom: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              backgroundColor: '#ffffff',
              padding: 12,
            }}
            textContentType="emailAddress"
            value={value}
          />
        )}
      />
      {errors.email ? <Text style={{ marginBottom: 8, fontSize: 12, color: '#ef4444' }}>{errors.email.message}</Text> : null}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Password"
            secureTextEntry
            testID="login-password-input"
            style={{
              marginBottom: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              backgroundColor: '#ffffff',
              padding: 12,
            }}
            textContentType="password"
            value={value}
          />
        )}
      />
      {errors.password ? <Text style={{ marginBottom: 8, fontSize: 12, color: '#ef4444' }}>{errors.password.message}</Text> : null}

      <TouchableOpacity
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        testID="login-submit-button"
        style={{
          alignItems: 'center',
          borderRadius: 12,
          padding: 12,
          backgroundColor: isSubmitting ? '#9ca3af' : '#1e40af',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Text>
      </TouchableOpacity>

      <View
        style={{
          marginTop: 20,
          borderRadius: 12,
          backgroundColor: '#f3f4f6',
          padding: 16,
        }}
      >
        <Text style={{ textAlign: 'center', fontSize: 12, color: '#6b7280' }}>Demo accounts:</Text>
        <Text style={{ textAlign: 'center', fontSize: 12, color: '#6b7280' }}>technik1@demo.cz / demo123</Text>
        <Text style={{ textAlign: 'center', fontSize: 12, color: '#6b7280' }}>technik2@demo.cz / demo123</Text>
      </View>
    </View>
  );
}

