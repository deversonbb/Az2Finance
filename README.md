# 💰 AZ² Finance — Manual de Uso

> Controle financeiro pessoal e compartilhado, rodando 100% no Google Apps Script e Google Drive.

---

## Índice

1. [Instalação](#1-instalação)
2. [Primeiro acesso](#2-primeiro-acesso)
3. [Layouts: mobile e desktop](#3-layouts-mobile-e-desktop)
4. [Tema claro e escuro](#4-tema-claro-e-escuro)
5. [Convidar membros](#5-convidar-membros)
6. [Espaços financeiros](#6-espaços-financeiros)
7. [Dashboard — tela inicial](#7-dashboard--tela-inicial)
8. [Lançamentos](#8-lançamentos)
9. [Parcelamento](#9-parcelamento)
10. [Lançamentos recorrentes](#10-lançamentos-recorrentes)
11. [Relatórios e gráficos](#11-relatórios-e-gráficos)
12. [Exportar PDF](#12-exportar-pdf)
13. [Alertas automáticos de vencimento](#13-alertas-automáticos-de-vencimento)
14. [Configurar gatilhos automáticos](#14-configurar-gatilhos-automáticos)
15. [Categorias](#15-categorias)
16. [Carteiras](#16-carteiras)
17. [Segurança e senhas](#17-segurança-e-senhas)
18. [Instalar como app no celular (PWA)](#18-instalar-como-app-no-celular-pwa)
19. [Estrutura de arquivos no Drive](#19-estrutura-de-arquivos-no-drive)
20. [Perguntas frequentes](#20-perguntas-frequentes)

---

## 1. Instalação

### O que você precisa
- Conta Google (Gmail)
- Acesso ao [Google Apps Script](https://script.google.com)

### Passo a passo

**1.1** Acesse [script.google.com](https://script.google.com) e clique em **Novo projeto**.

**1.2** Apague o código de exemplo e cole o conteúdo do arquivo `Código.gs`.

**1.3** Crie o arquivo mobile: clique no **+** ao lado de "Arquivos" → **HTML** → nomeie `Index` (sem extensão) → cole o conteúdo de `Index.html`.

**1.4** Crie o arquivo desktop: repita o passo 1.3, nomeie `Desktop` → cole o conteúdo de `Desktop.html`.

**1.5** Salve o projeto com o nome **AZ² Finance** (Ctrl+S).

**1.6** No menu suspenso de funções, selecione `initDatabase` e clique em **Executar**. Autorize as permissões quando solicitado.

**1.7** Selecione `criarAdmin` e clique em **Executar**. Isso cria o usuário `admin`, o espaço inicial com categorias e carteiras padrão.

**1.8** Configure o segredo de segurança dos tokens: selecione `setTokenSecret` e clique em **Executar**. Isso gera e salva internamente um segredo criptográfico usado para assinar os links de convite. Se não executar, o segredo é gerado automaticamente no primeiro convite — mas executar explicitamente é recomendado.

**1.9** Autorize o envio de emails: selecione `testarEnvioEmail` e clique em **Executar**. Conceda as permissões quando solicitado. Você receberá um email de teste na sua conta Google confirmando que o envio está funcionando.

> ⚠️ **Este passo é obrigatório.** Sem ele, convites por email e alertas de vencimento não serão enviados, mesmo que o resto do sistema funcione normalmente.

**1.10** Configure os gatilhos automáticos: selecione `configurarGatilhos` e clique em **Executar**. Isso cria os alertas de vencimento e a geração de recorrências mensais.

**1.11** Publique o app:
- Clique em **Implantar** → **Nova implantação**
- Tipo: **App da Web**
- Executar como: **Eu** (sua conta Google)
- Quem tem acesso: **Qualquer pessoa com Conta do Google**
- Clique em **Implantar** e copie a URL gerada

**1.12** Acesse a URL. No celular, o app abre o layout mobile. No computador, abre o layout desktop. 
Faça login com `admin` / `admin123` — o sistema pedirá que você defina seu nome e senha pessoal antes de continuar.
**OBS.: Se não pedir para trocar a senha, faça manualmente clicando no Mobile icone do usuário superior esquerdo, no Desktop na engrenagem ao lado do nome do dono.**

---

## 2. Primeiro acesso

Ao fazer login pela primeira vez com o usuário `admin`, o sistema exibe um **modal obrigatório** que não pode ser fechado nem pulado. Ele pede:

- **Seu nome** — como você quer ser identificado no app
- **Nova senha** — mínimo 6 caracteres
- **Confirmação da senha**

O botão "Salvar e entrar" só fica ativo quando todos os campos estão preenchidos corretamente. Após salvar, o app já abre com o nome e a senha definidos.

Para acessos futuros, marque **"Lembrar minha senha neste dispositivo"** na tela de login para não precisar digitar as credenciais novamente.

---

## 3. Layouts: mobile e desktop

O sistema detecta automaticamente o dispositivo e serve o layout adequado — **mesma URL para os dois**.

| Layout | Quando é servido | Características |
|--------|-----------------|-----------------|
| Mobile (`Index.html`) | Tela ≤ 768px ou User-Agent mobile | Barra de navegação inferior, cards empilhados, botão + central |
| Desktop (`Desktop.html`) | Tela > 768px em navegador desktop | Sidebar fixa à esquerda, tabela de lançamentos com busca e paginação, painel lateral de gráficos por categoria |

A detecção acontece **no navegador** (não no servidor), usando `window.innerWidth` e `navigator.userAgent`. Ao abrir a URL, uma tela de loading aparece por um instante enquanto o dispositivo é identificado e o layout correto é carregado. Isso garante que a detecção seja precisa em qualquer situação — celular, tablet, notebook ou desktop.

---

## 4. Tema claro e escuro

Ambos os layouts têm um botão de alternância de tema:

- **Mobile:** ícone 🌙/☀️ no canto superior direito da tela Início
- **Desktop:** ícone 🌙/☀️ na barra superior direita

A preferência é salva no dispositivo via `localStorage` e persiste entre sessões — não precisa escolher de novo a cada acesso. O padrão é escuro no mobile e claro no desktop.

---

## 5. Convidar membros

O AZ² Finance usa **convite por email** para garantir que apenas pessoas autorizadas tenham acesso.

### Como convidar

1. Vá para a aba **Espaço**
2. No bloco **Convidar por email**, digite o email do convidado
3. Toque em **Enviar**

O sistema envia automaticamente um email com link de convite válido por **7 dias** e adiciona o email nas permissões do Web App.

> O convidado precisa ter uma conta Google ativa para aceitar o convite.

### Como o convidado acessa

1. Abre o email e clica em **Aceitar convite**
2. Preenche nome e cria uma senha (mínimo 6 caracteres)
3. Entra direto no espaço compartilhado

O login do convidado é o próprio email dele.

### Papéis disponíveis

| Papel | Lançar | Convidar | Remover membros |
|-------|:------:|:--------:|:---------------:|
| Dono  | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ❌ |
| Membro| ✅ | ❌ | ❌ |

---

## 6. Espaços financeiros

Um **espaço** é um conjunto isolado de finanças — categorias, carteiras e lançamentos próprios, sem interferir em outros espaços.

- Um casal usa o **mesmo espaço**: os dois veem e lançam as mesmas contas
- Uma pessoa sozinha tem o **próprio espaço**
- É possível pertencer a **vários espaços** ao mesmo tempo

### Criar um espaço

1. Vá em **Espaço**
2. No bloco **Criar novo espaço**, informe um nome
3. Clique em **Criar**

O novo espaço já vem com categorias e carteiras padrão.

### Trocar de espaço ativo

Na seção **Meus espaços**, toque no espaço desejado. O app recarrega os dados automaticamente.

---

## 7. Dashboard — tela inicial

A tela inicial mostra um resumo financeiro do **mês atual**, atualizado automaticamente após cada operação.

| Elemento | O que mostra |
|----------|-------------|
| Saldo previsto | Recebido − Pago + A receber − A pagar |
| A pagar | Total de contas pendentes e atrasadas |
| A receber | Total de receitas ainda não recebidas |
| Próximos vencimentos | Lançamentos que vencem nos próximos 7 dias |

No **desktop**, o painel direito também exibe um resumo de gastos por categoria com barras de progresso, e a lista de membros do espaço.

---

## 8. Lançamentos

### Criar um lançamento

**Mobile:** toque no botão **+** no centro da barra inferior.
**Desktop:** clique em **Novo lançamento** na barra superior.

### Campos do formulário

| Campo | Descrição |
|-------|-----------|
| Tipo | A pagar (despesa) ou A receber (receita) |
| Descrição | Nome da conta ou receita |
| Categoria | Classificação (ex: Moradia, Salário) |
| Carteira | De onde sai ou entra o dinheiro |
| Pagamento | À vista ou Parcelado |
| Vencimento | Data de vencimento (ou 1º vencimento se parcelado) |
| Recorrência | Nenhuma, Mensal ou Anual |
| Comprovante | Foto ou PDF — máx. 4 MB, salvo no Drive |

### Status dos lançamentos

| Status | Significado | Indicador |
|--------|-------------|-----------|
| Pendente | Vence no futuro, não pago | Amarelo |
| Atrasado | Venceu e não foi pago | Vermelho |
| Pago | Quitado | Verde |

### Marcar como pago

Toque em **✓ Pagar** no lançamento. A data de pagamento é registrada automaticamente. Para desfazer, toque em **↩ Desfazer**.

### Navegar entre meses

Use as setas **‹** e **›** para ver meses anteriores ou futuros.

### Filtros

Todos · A pagar · A receber · Atrasados · Pagos

### Busca por texto (desktop)

Na tela de lançamentos do desktop há um campo de busca que filtra por descrição em tempo real. Os resultados são paginados em grupos de 20 por página.

---

## 9. Parcelamento

O app cria um lançamento separado para cada parcela, no mês de vencimento correto. Todas as parcelas compartilham o mesmo grupo, o que permite excluí-las em conjunto.

### Como lançar

1. No formulário, escolha **Parcelado**
2. Informe o **valor por parcela** (ex: R$ 150,00)
3. Informe o **número de parcelas** (ex: 6)
4. A prévia mostra: `6 × R$ 150,00 = R$ 900,00 · jun–nov`
5. Informe o **1º vencimento** e salve

### Como aparecem na lista

> Notebook **1/6** — pendente — R$ 150,00

### Excluir parcelas

Ao excluir um lançamento parcelado, o app pergunta:

- **Só este** — remove apenas a parcela selecionada
- **Este e os próximos** — remove a parcela atual e todas as futuras do mesmo grupo

---

## 10. Lançamentos recorrentes

Lançamentos marcados como **Mensal** são gerados automaticamente todo dia 1º do mês, sem precisar recadastrar.

### Como configurar

Ao criar ou editar um lançamento, selecione **Mensal** no campo **Recorrência**. O sistema identifica esses lançamentos no mês anterior e cria cópias para o mês atual, mantendo o mesmo dia de vencimento.

### Observações

- O gatilho roda diariamente mas só age no **dia 1** de cada mês
- Duplicatas são evitadas automaticamente por comparação de descrição, valor e tipo
- Lançamentos parcelados não entram na recorrência automática (cada parcela já tem seu mês definido)
- Para que funcione, `configurarGatilhos()` deve ter sido executado na instalação

---

## 11. Relatórios e gráficos

A tela **Relatórios** exibe uma análise visual completa do mês selecionado.

### Como acessar

**Mobile:** toque em **Relatór.** na barra de navegação inferior.
**Desktop:** clique em **Relatórios** na sidebar.

### O que é exibido

**KPIs do mês:** Saldo, Total recebido, Total pago, A receber, A pagar.

**Gráficos:**

| Gráfico | Tipo | O que mostra |
|---------|------|-------------|
| Pago por categoria | Barras horizontais | Quanto foi pago em cada categoria de despesa |
| Recebido por categoria | Barras horizontais | Quanto foi recebido em cada categoria de receita |
| Despesas por categoria | Donut | Distribuição percentual de cada categoria de despesa |
| Entradas vs Saídas | Barras | Comparação entre recebido, pago, a receber e a pagar |
| Últimos 6 meses | Barras agrupadas | Histórico de recebido vs pago nos 6 meses anteriores |
| Saldo acumulado | Linha | Evolução do saldo dia a dia ao longo do mês |

### Navegar entre períodos

Use os seletores de **mês** e **ano** no topo da tela para analisar qualquer período com lançamentos registrados.

---

## 12. Exportar PDF

Gera um relatório em PDF do fechamento mensal e salva no Drive.

### Como exportar

1. Acesse a tela **Relatórios**
2. Selecione o mês e ano desejados
3. Clique em **📄 Exportar PDF** (desktop) ou **📄 PDF** (mobile)
4. Aguarde a geração — o arquivo abre automaticamente em nova aba

### O que contém o PDF

- Resumo com saldo, total recebido, total pago, a receber e a pagar
- Tabela de despesas por categoria com valores
- Data e hora de geração
- Nome do espaço financeiro

O arquivo fica salvo na pasta `Anexos/[espaco_id]/` no Drive e pode ser acessado a qualquer momento pelo Google Drive.

---

## 13. Alertas automáticos de vencimento

O sistema envia um **email automático** diariamente às 7h para todos os membros do espaço quando há lançamentos atrasados ou que vencem nos próximos 3 dias.

### O que o email contém

- Lista de **pagamentos atrasados** (em vermelho) com descrição, data de vencimento e valor
- Lista de **vencimentos próximos** (próximos 3 dias) com as mesmas informações
- O email só é enviado quando há itens para alertar — dias sem vencimentos próximos não geram email

### Para ativar

Execute `testarEnvioEmail()` uma vez no editor para autorizar o envio de emails — você receberá um email de confirmação na sua conta. Em seguida, execute `configurarGatilhos()` para criar o gatilho diário. Sem a autorização do `testarEnvioEmail`, nenhum email é enviado pelo sistema.

---

## 14. Configurar gatilhos automáticos

Os gatilhos habilitam os alertas de vencimento e a geração de recorrências. Execute **uma única vez** após a instalação.

**14.1** Abra o projeto no [script.google.com](https://script.google.com)

**14.2** No menu suspenso de funções, selecione `configurarGatilhos`

**14.3** Clique em **Executar**

O sistema cria dois gatilhos:

| Gatilho | Função | Horário |
|---------|--------|---------|
| Alerta de vencimentos | `alertaVencimentos` | Diário às 7h |
| Gerar recorrências | `gerarRecorrencias` | Diário às 6h (age só no dia 1) |

Para verificar os gatilhos criados, acesse **Gatilhos** no menu esquerdo do editor (ícone de relógio).

> Se executar `configurarGatilhos()` mais de uma vez, os gatilhos antigos são removidos automaticamente antes de criar os novos — sem duplicatas.

---

## 15. Categorias

As categorias organizam os lançamentos. O gerenciamento fica diretamente na tela **Espaço**.

### Criar categoria

1. Na tela **Espaço**, role até **Categorias**
2. Clique em **+ Nova**
3. Preencha nome, tipo (Despesa/Receita), ícone (emoji) e cor
4. Clique em **Salvar**

### Editar

Clique em ✏️ ao lado da categoria. O formulário abre preenchido.

### Remover

Clique em **×**. Os lançamentos vinculados não são apagados.

### Categorias padrão

**Despesas:** Alimentação, Moradia, Transporte, Saúde, Educação, Lazer, Roupas, Assinaturas, Outros

**Receitas:** Salário, Freelance, Investimento, Outros

---

## 16. Carteiras

As carteiras representam contas bancárias, cartões ou dinheiro em espécie. O gerenciamento fica na tela **Espaço**.

### Criar carteira

1. Na tela **Espaço**, role até **Carteiras**
2. Clique em **+ Nova**
3. Informe nome, tipo e saldo inicial (opcional)
4. Clique em **Salvar**

### Tipos disponíveis

Conta corrente · Poupança · Cartão de crédito · Dinheiro · Investimento

### Editar / Remover

Mesmos botões ✏️ e × das categorias. Remover não apaga os lançamentos vinculados.

### Carteiras padrão

Conta Corrente, Poupança, Dinheiro e Cartão de Crédito — criadas automaticamente ao criar um espaço.

---

## 17. Segurança e senhas

### Primeiro acesso

Na primeira entrada com o `admin`, o sistema exibe um modal obrigatório para definir nome e senha pessoal. Não pode ser pulado.

### Editar nome e senha

Clique no ícone 👤 no topo da tela Início (ou **Minha conta** na tela Espaço). O modal permite:

- Alterar o **nome** sem mexer nos campos de senha
- Trocar a senha preenchendo os três campos — deixe em branco para não alterar

### Lembrar senha

Na tela de login, marque **"Lembrar minha senha neste dispositivo"**. As credenciais ficam salvas localmente no dispositivo.

### Sessão persistente

Ao atualizar a página, a sessão é restaurada automaticamente sem pedir login novamente, enquanto a aba estiver aberta.

### Bloqueio por tentativas incorretas

Após **5 tentativas de login incorretas**, a conta é bloqueada automaticamente por **5 minutos**. Isso protege contra ataques de força bruta. O bloqueio é por usuário — outros usuários não são afetados.

### Armazenamento de senhas

As senhas nunca ficam em texto puro. O sistema usa **SHA-256 com salt individual por usuário** — mesmo com acesso direto à planilha, não é possível recuperar a senha original.

### Tokens de convite assinados

Os links de convite são assinados com **HMAC-SHA256** usando um segredo interno gerado na instalação (`setTokenSecret()`). Isso impede que tokens sejam forjados mesmo que alguém tenha acesso direto à planilha de convites. Os tokens expiram em **7 dias**.

### Arquivos privados no Drive

Comprovantes e PDFs de relatório ficam **privados no Google Drive** — não são compartilhados publicamente. O acesso é feito via autenticação com dupla verificação: o sistema confirma que o usuário pertence ao espaço **e** que o arquivo solicitado está fisicamente dentro da pasta daquele espaço no Drive. Isso impede que um usuário de um espaço acesse comprovantes de outro espaço mesmo conhecendo o ID do arquivo.

### Autorização por espaço

Todas as operações — tanto de **leitura** (listar lançamentos, dashboard, relatórios, PDF, categorias, carteiras, membros) quanto de **escrita** (salvar, marcar pago, excluir lançamentos, salvar e excluir categorias e carteiras) — verificam se o usuário pertence ao espaço financeiro correspondente. Não é possível ler nem operar em dados de outro espaço, mesmo conhecendo o ID.

### Proteção contra clickjacking

O app usa `X-Frame-Options: SAMEORIGIN` — não pode ser embutido em sites externos, protegendo contra ataques que enganam o usuário a clicar em ações sem perceber.

### Convites

Links de convite expiram em **7 dias**. Ninguém consegue se cadastrar sem ter recebido um convite.

---

## 18. Instalar como app no celular (PWA)

O layout mobile pode ser instalado como um ícone na tela inicial do celular, funcionando como um app nativo.

### Android (Chrome)

1. Abra a URL do AZ² Finance no Chrome
2. Toque nos três pontos (menu) → **Adicionar à tela inicial**
3. Confirme o nome e toque em **Adicionar**

O Chrome também pode exibir automaticamente um banner de instalação na parte inferior da tela.

### iPhone / iPad (Safari)

1. Abra a URL no Safari
2. Toque no ícone de **Compartilhar** (quadrado com seta)
3. Selecione **Adicionar à Tela de Início**
4. Confirme o nome e toque em **Adicionar**

Após instalar, o app abre em tela cheia sem a barra do navegador, com ícone próprio na tela inicial.

### Modo offline

O app tem um service worker básico. Se a conexão cair enquanto ele estiver aberto, uma mensagem de "offline" é exibida em vez de um erro de navegador.

---

## 19. Estrutura de arquivos no Drive

Após a instalação, o sistema cria automaticamente a pasta **`AZ2Finance - BD`** no Google Drive:

```
AZ2Finance - BD/
├── usuarios              ← contas (hash de senha + salt, nunca texto puro)
├── convites              ← tokens de convite e status
├── espacos               ← espaços financeiros cadastrados
├── membros_espaco        ← quem pertence a cada espaço e com qual papel
├── categorias            ← categorias de despesa e receita por espaço
├── carteiras             ← contas e cartões por espaço
├── lanc_XXXXXXXX_06_2026 ← lançamentos de jun/2026 do espaço X
├── lanc_XXXXXXXX_07_2026 ← lançamentos de jul/2026 do espaço X
└── Anexos/
    └── [espaco_id]/      ← comprovantes (fotos/PDFs) e relatórios PDF
```

As planilhas de lançamentos são criadas mês a mês conforme necessário. Os relatórios PDF exportados ficam dentro da pasta `Anexos/[espaco_id]/`.

---

## 20. Perguntas frequentes

**O saldo não está atualizando.**
O saldo atualiza automaticamente após marcar pago, criar ou excluir lançamentos. Se ainda assim não atualizar, volte para a tela Início tocando no ícone 🏠.

**O app abriu o layout errado (mobile no computador ou vice-versa).**
A detecção é feita pelo User-Agent do navegador. Em casos raros (tablets com User-Agent ambíguo), o layout pode não ser o esperado. Não há configuração manual por URL — a detecção é automática.

**O tema volta para o padrão toda vez que acesso.**
O tema é salvo por dispositivo via `localStorage`. Se o navegador estiver em modo privado/anônimo, o `localStorage` é apagado ao fechar. Use o modo normal para que a preferência persista.

**O app pediu nome e senha logo após o primeiro login — é normal?**
Sim. Na primeira entrada com `admin`, o sistema exige a definição de nome e senha pessoal. Não pode ser pulado.

**Ao fechar e reabrir o navegador, o sistema desloga.**
Isso é esperado — a sessão usa `sessionStorage`, que é apagado ao fechar o navegador. Para não digitar as credenciais toda vez, marque **"Lembrar minha senha"** na tela de login.

**Como mudo meu nome no sistema?**
Toque no ícone 👤 no topo ou em **Minha conta** na tela Espaço. Altere o nome e salve — não precisa mexer nos campos de senha.

**Fiz login errado várias vezes e agora aparece "conta bloqueada".**
Após 5 tentativas incorretas, o sistema bloqueia o acesso por 5 minutos automaticamente. Aguarde e tente novamente com a senha correta. Se tiver esquecido a senha, peça ao administrador para redefini-la.

**Esqueci minha senha.**
Peça ao administrador que execute `criarAdmin()` no editor (ele não sobrescreve usuários existentes) ou que atualize manualmente a linha do usuário na planilha `usuarios` com um novo hash. Depois acesse o app e troque a senha em **Minha conta**.

**O convidado não recebeu o email.**
Verifique se o endereço está correto e se não caiu na pasta de spam. Se o convite expirou (mais de 7 dias), envie um novo.

**Os relatórios não mostram dados.**
Os gráficos dependem de lançamentos no mês selecionado. Verifique se há lançamentos cadastrados para o período escolhido. O saldo acumulado só mostra movimento nos dias em que há data de pagamento preenchida.

**Os gatilhos automáticos não estão funcionando.**
Verifique se `configurarGatilhos()` foi executado. Para confirmar, acesse o menu **Gatilhos** no editor do Apps Script (ícone de relógio) e veja se as funções `alertaVencimentos` e `gerarRecorrencias` aparecem na lista.

**O PDF gerado está em branco ou com erro.**
O Apps Script precisa de permissão para criar arquivos no Drive. Se a permissão não foi concedida na instalação, abra o editor, execute qualquer função e reautorize quando solicitado. O PDF fica salvo privativamente no Drive — somente usuários do espaço conseguem acessá-lo pela função autenticada do sistema.

**Posso instalar em mais de um celular?**
Sim. Cada dispositivo tem sua própria preferência de tema e credenciais salvas, mas todos acessam os mesmos dados no Drive.

**Os dados são privados?**
Os dados ficam no **seu próprio Google Drive**, na sua conta Google. Nenhum terceiro tem acesso.

**Quanto custa?**
Nada. O sistema usa apenas Google Apps Script e Google Drive, que são gratuitos para contas pessoais dentro dos limites normais de uso.

---

*AZ² Finance — desenvolvido com Google Apps Script*
*Última atualização: junho de 2026*
*www.az2.com.br*
