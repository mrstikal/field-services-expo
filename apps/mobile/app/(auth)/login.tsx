 
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
    <View className="flex-1 justify-center bg-slate-100 p-5">
      <Text className="mb-2 text-center text-4xl font-bold text-blue-800">Field Service</Text>
      <Text className="mb-8 text-center text-base text-gray-500">Technician Login</Text>

      {error ? <Text className="mb-3 text-center text-red-500">{error}</Text> : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            autoCapitalize="none"
            className="mb-3 rounded-lg border border-gray-200 bg-white p-3"
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Email"
            textContentType="emailAddress"
            value={value}
          />
        )}
      />
      {errors.email ? <Text className="mb-2 text-xs text-red-500">{errors.email.message}</Text> : null}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-3 rounded-lg border border-gray-200 bg-white p-3"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Password"
            secureTextEntry
            textContentType="password"
            value={value}
          />
        )}
      />
      {errors.password ? <Text className="mb-2 text-xs text-red-500">{errors.password.message}</Text> : null}

      <TouchableOpacity
        className={`items-center rounded-lg p-3 ${isSubmitting ? 'bg-gray-400' : 'bg-blue-800'}`}
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="text-base font-semibold text-white">{isSubmitting ? 'Signing in...' : 'Sign in'}</Text>
      </TouchableOpacity>

      <View className="mt-5 rounded-lg bg-gray-100 p-4">
        <Text className="text-center text-xs text-gray-500">Demo accounts:</Text>
        <Text className="text-center text-xs text-gray-500">technik1@demo.cz / demo123</Text>
        <Text className="text-center text-xs text-gray-500">technik2@demo.cz / demo123</Text>
      </View>
    </View>
  );
}

