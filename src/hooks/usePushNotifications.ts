import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

interface UsePushNotificationsProps {
  cidadeId: string | null;
  userId?: string | null;
}

export function usePushNotifications({ cidadeId, userId = null }: UsePushNotificationsProps) {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications so funcionam em apps nativos');
      return;
    }

    const initPushNotifications = async () => {
      try {
        // Verifica permissao atual
        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          // Solicita permissao
          const requestResult = await PushNotifications.requestPermissions();
          setPermissionStatus(requestResult.receive as 'granted' | 'denied' | 'prompt');

          if (requestResult.receive !== 'granted') {
            console.log('Permissao de notificacao negada');
            return;
          }
        } else if (permStatus.receive === 'denied') {
          setPermissionStatus('denied');
          console.log('Permissao de notificacao negada anteriormente');
          return;
        } else {
          setPermissionStatus('granted');
        }

        if (Capacitor.getPlatform() === 'android') {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'Notificacoes',
            description: 'Canal padrao de notificacoes',
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true,
          });
        }

        // Listener para receber o token
        const registrationListener = await PushNotifications.addListener('registration', async (tokenData) => {
          console.log('Token de push recebido:', tokenData.value);
          setToken(tokenData.value);

          // Salva o token no Supabase se tiver cidade
          if (cidadeId && tokenData.value) {
            await saveTokenToSupabase(cidadeId, tokenData.value, userId);
          }
        });

        // Listener para erros de registro
        const registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('Erro ao registrar push:', error);
          setLastError(error?.error || error?.message || JSON.stringify(error));
        });

        // Listener para notificacoes recebidas (app em primeiro plano)
        const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Notificacao recebida:', notification);
        });

        // Listener para quando usuario toca na notificacao
        const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Acao na notificacao:', notification);
        });

        // Registra para push notifications (depois dos listeners)
        await PushNotifications.register();

        return () => {
          registrationListener.remove();
          registrationErrorListener.remove();
          receivedListener.remove();
          actionListener.remove();
        };
      } catch (error) {
        console.error('Erro ao inicializar push notifications:', error);
        setLastError(error instanceof Error ? error.message : String(error));
        return undefined;
      }
    };

    let cleanupPromise: Promise<(() => void) | undefined> | null = initPushNotifications();

    return () => {
      if (cleanupPromise) {
        cleanupPromise.then((cleanup) => cleanup?.());
      }
      cleanupPromise = null;
    };
  }, [cidadeId, userId]);

  // Salva/atualiza token
  const saveTokenToSupabase = async (cidadeIdValue: string, deviceToken: string, currentUserId?: string | null) => {
    const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

    try {
      const { error } = await supabase
        .from('rel_cidade_push_tokens')
        .upsert(
          {
            cidade_id: cidadeIdValue,
            device_token: deviceToken,
            user_id: currentUserId || null,
            platform,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'cidade_id,device_token',
          }
        );

      if (error) {
        console.error('Erro ao salvar token:', error);
      } else {
        console.log('Token salvo com sucesso para cidade:', cidadeIdValue);
      }
    } catch (error) {
      console.error('Erro ao salvar token no Supabase:', error);
    }
  };

  const updateCidade = async (newCidadeId: string) => {
    if (token && newCidadeId) {
      await saveTokenToSupabase(newCidadeId, token, userId);
    }
  };

  // Backfill automatico: quando usuario loga (ou app reabre com sessao),
  // vincula o token ja existente ao user_id sem depender de novo registro.
  useEffect(() => {
    if (!cidadeId || !token || !userId) return;
    void saveTokenToSupabase(cidadeId, token, userId);
  }, [cidadeId, token, userId]);

  return {
    token,
    permissionStatus,
    lastError,
    updateCidade,
  };
}
