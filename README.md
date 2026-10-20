# Ritmo

Agenda e rotina para eu conseguir organizar o dia e registrar o que fiz. Comecei este projeto pensando na minha própria experiência com TDAH.

## O que tem

- Agenda por dia, com tarefas e horários.
- Registro das tarefas concluídas.
- Pontos e recompensas que posso configurar.
- Projetos e blocos de rotina.
- Temporizador de foco.
- Lembretes de pausa opcionais no Android.

Os dados da agenda ficam no próprio aparelho. O monitor de uso do celular é opcional e só funciona depois de ativar o Acesso ao uso nas configurações do Android e permitir notificações. Ele não lê mensagens, conteúdo da tela ou teclas, nem guarda nomes de aplicativos.

## Rodar no computador

Requer Node.js 20 ou superior.

```sh
npm install
npm run dev
```

## Gerar o APK de depuração

Requer Java 21, Android SDK Platform 36 e Android Build Tools 36.

```sh
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

O arquivo gerado fica em `android/app/build/outputs/apk/debug/app-debug.apk`. É um APK de depuração para testes pessoais; ainda não foi validado em diferentes aparelhos e não é uma versão da Play Store.
