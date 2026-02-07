import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

interface UsePushNotificationsProps {
  cidadeId: string | null;
}

export function usePushNotifications({ cidadeId }: UsePushNotificationsProps) {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications só funcionam em apps nativos');
      return;
    }

    const initPushNotifications = async () => {
      try {
        // Verifica permissão atual
        const permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
          // Solicita permissão
          const requestResult = await PushNotifications.requestPermissions();
          setPermissionStatus(requestResult.receive as 'granted' | 'denied' | 'prompt');
          
          if (requestResult.receive !== 'granted') {
            console.log('Permissão de notificação negada');
            return;
          }
        } else if (permStatus.receive === 'denied') {
          setPermissionStatus('denied');
          console.log('Permissão de notificação negada anteriormente');
          return;
        } else {
          setPermissionStatus('granted');
        }

        // Registra para push notifications
        await PushNotifications.register();

        // Listener para receber o token
        PushNotifications.addListener('registration', async (tokenData) => {
          console.log('Token de push recebido:', tokenData.value);
          setToken(tokenData.value);
          
          // Salva o token no Supabase se tiver cidade
          if (cidadeId && tokenData.value) {
            await saveTokenToSupabase(cidadeId, tokenData.value);
          }
        });

        // Listener para erros de registro
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Erro ao registrar push:', error);
        });

        // Listener para notificações recebidas (app em primeiro plano)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Notificação recebida:', notification);
        });

        // Listener para quando usuário toca na notificação
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Ação na notificação:', notification);
        });

      } catch (error) {
        console.error('Erro ao inicializar push notifications:', error);
      }
    };

    initPushNotifications();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [cidadeId]);

  // Salva/atualiza token no Supabase
  const saveTokenToSupabase = async (cidadeId: string, deviceToken: string) => {
    const platform = Capacitor.getPlatform(); // 'ios' ou 'android'
    
    try {
      // Usa upsert para inserir ou atualizar
      const { error } = await supabase
        .from('rel_cidade_push_tokens')
        .upsert(
          {
            cidade_id: cidadeId,
            device_token: deviceToken,
            platform: platform,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'cidade_id,device_token'
          }
        );

      if (error) {
        console.error('Erro ao salvar token:', error);
      } else {
        console.log('Token salvo com sucesso para cidade:', cidadeId);
      }
    } catch (error) {
      console.error('Erro ao salvar token no Supabase:', error);
    }
  };

  // Função para atualizar cidade (quando usuário muda de cidade)
  const updateCidade = async (newCidadeId: string) => {
    if (token && newCidadeId) {
      await saveTokenToSupabase(newCidadeId, token);
    }
  };

  return {
    token,
    permissionStatus,
    updateCidade
  };
}
