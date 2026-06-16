/**
 * =====================================================================
 *  AZ² FINANCE
 *  Backend Google Apps Script
 *  Banco de dados: Google Drive (planilhas separadas por tipo)
 * =====================================================================
 *  Autor:    Déverson Brasil Barcellos
 *  Data:     11.06.2026
 *  Suporte:  +55 (51) 98552.8251
 * =====================================================================
 *  INSTRUCOES DE INSTALACAO:
 *  1. Acesse script.google.com e crie um novo projeto
 *  2. Cole este arquivo como "Codigo.gs"
 *  3. Crie o arquivo "Index.html" e cole o conteudo do Index.html (mobile)
 *  4. Crie o arquivo "Desktop.html" e cole o conteudo do Desktop.html
 *  5. Execute initDatabase() no editor (UMA VEZ)
 *  6. Execute criarAdmin() no editor (UMA VEZ)
 *  7. Execute testarEnvioEmail() — autoriza o envio de emails e confirma
 *     que as notificacoes e convites funcionam. Voce recebera um email
 *     de teste na sua conta Google. SE NAO EXECUTAR ESTE PASSO,
 *     convites e alertas de vencimento NAO serao enviados.
 *  8. Execute configurarGatilhos() — ativa alertas diarios de vencimento
 *     e geracao automatica de lancamentos recorrentes (UMA VEZ)
 *  9. Publique: Implantar > Nova implantacao > Web App
 *     - Executar como: Sua conta Google
 *     - Quem tem acesso: Qualquer pessoa com conta Google
 * 10. Acesse a URL — mobile ve Index.html, desktop ve Desktop.html
 * 11. No primeiro login como admin, defina seu nome e senha pessoal
 * =====================================================================
 */

// ---------- CONFIGURACOES GLOBAIS ----------
var PASTA_RAIZ        = 'AZ2Finance - BD';
var PASTA_ANEXOS      = 'Anexos';
var PLAN_USUARIOS     = 'usuarios';
var PLAN_CONVITES     = 'convites';
var PLAN_ESPACOS      = 'espacos';
var PLAN_MEMBROS      = 'membros_espaco';
var PLAN_CATEGORIAS   = 'categorias';
var PLAN_CARTEIRAS    = 'carteiras';
var _cache = {};

// ---------- CABECALHOS DE CADA PLANILHA ----------
var HEADERS = {
  usuarios: ['id', 'nome', 'email', 'login', 'senha_hash', 'salt', 'perfil_sistema', 'status', 'data_cadastro'],
  convites:  ['id', 'email', 'token', 'espaco_id', 'status', 'convidado_por', 'data_envio', 'data_aceite'],
  espacos:   ['id', 'nome', 'dono_id', 'data_criacao'],
  membros_espaco: ['id', 'espaco_id', 'usuario_id', 'perfil', 'data_entrada'],
  categorias: ['id', 'espaco_id', 'nome', 'tipo', 'cor', 'icone', 'ativa'],
  carteiras:  ['id', 'espaco_id', 'nome', 'tipo', 'saldo_inicial', 'ativa'],
  lancamentos: [
    'id', 'espaco_id', 'tipo', 'descricao', 'valor',
    'categoria_id', 'carteira_id',
    'data_lancamento', 'data_vencimento', 'data_pagamento',
    'status', 'recorrencia',
    'grupo_id', 'parcela_num', 'parcela_total',
    'anexo_url', 'criado_por', 'data_criacao'
  ]
};

// =====================================================================
//  PONTO DE ENTRADA - WEB APP
//  Serve Index.html para mobile e Desktop.html para desktop
// =====================================================================
/**
 * doGet — serve uma página de detecção mínima que:
 * 1. Detecta o dispositivo no navegador (window.innerWidth + userAgent)
 * 2. Chama getLayout(isMobile, token) via google.script.run
 * 3. Substitui o documento pelo HTML correto (Index ou Desktop)
 *
 * Motivo: o GAS não expõe headers HTTP em doGet, então a detecção
 * server-side nunca funcionou. A detecção client-side é a única forma confiável.
 */
function doGet(e) {
  var token = (e && e.parameter && e.parameter.convite) ? e.parameter.convite : '';

  var html = '<!DOCTYPE html><html><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>AZ\u00b2 Finance</title>'
    + '<style>'
    + 'body{margin:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;}'
    + '.spinner{width:40px;height:40px;border:3px solid #262626;border-top-color:#3b82f6;border-radius:50%;animation:spin .8s linear infinite;}'
    + '@keyframes spin{to{transform:rotate(360deg)}}'
    + 'p{color:#94a3b8;font-family:sans-serif;font-size:.9rem;margin:0;}'
    + '</style>'
    + '</head><body>'
    + '<div class="spinner"></div><p>Carregando...</p>'
    + '<script>'
    + 'var TOKEN="' + token.replace(/[^a-zA-Z0-9\-]/g, '') + '";'  // sanitiza token
    + 'var isMobile=(window.innerWidth<=768)'
    + '||/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent);'
    + 'google.script.run'
    + '.withSuccessHandler(function(html){'
    + 'document.open();document.write(html);document.close();'
    + '})'
    + '.withFailureHandler(function(e){'
    + 'document.body.innerHTML="<p style=\'color:#ef4444;font-family:sans-serif;padding:24px;\'>Erro ao carregar: "+e.message+"</p>";'
    + '})'
    + '.getLayout(isMobile,TOKEN);'
    + '</script>'
    + '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('AZ\u00b2 Finance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Chamado pelo cliente após detecção do dispositivo.
 * Retorna o HTML completo do layout correto como string.
 */
function getLayout(isMobile, token) {
  var arquivo = isMobile ? 'Index' : 'Desktop';
  var tmpl    = HtmlService.createTemplateFromFile(arquivo);
  tmpl.tokenConvite = token || '';
  return tmpl.evaluate().getContent();
}

// =====================================================================
//  GERENCIAMENTO DE PASTA E PLANILHAS NO DRIVE
//  (mesmo padrao da oficina, sem alteracoes)
// =====================================================================
function _getPastaRaiz() {
  if (_cache.pastaRaizId) {
    try { return DriveApp.getFolderById(_cache.pastaRaizId); }
    catch (e) { delete _cache.pastaRaizId; }
  }
  var it = DriveApp.getFoldersByName(PASTA_RAIZ);
  var pasta;
  if (it.hasNext()) {
    pasta = it.next();
  } else {
    pasta = DriveApp.createFolder(PASTA_RAIZ);
  }
  _cache.pastaRaizId = pasta.getId();
  return pasta;
}

function _getPastaAnexos(espaçoId) {
  var raiz = _getPastaRaiz();
  var itAnexos = raiz.getFoldersByName(PASTA_ANEXOS);
  var pastaAnexos;
  if (itAnexos.hasNext()) {
    pastaAnexos = itAnexos.next();
  } else {
    pastaAnexos = raiz.createFolder(PASTA_ANEXOS);
  }
  if (!espaçoId) return pastaAnexos;
  var itEspaco = pastaAnexos.getFoldersByName(String(espaçoId));
  if (itEspaco.hasNext()) return itEspaco.next();
  return pastaAnexos.createFolder(String(espaçoId));
}

function _getPlanilha(nome) {
  if (_cache[nome]) {
    try { return SpreadsheetApp.openById(_cache[nome]); }
    catch (e) { delete _cache[nome]; }
  }
  var pasta = _getPastaRaiz();
  var it = pasta.getFilesByName(nome);
  if (it.hasNext()) {
    var id = it.next().getId();
    _cache[nome] = id;
    return SpreadsheetApp.openById(id);
  }
  return null;
}

function _criarPlanilha(nome, headers) {
  var pasta = _getPastaRaiz();
  var existente = pasta.getFilesByName(nome);
  if (existente.hasNext()) {
    var id = existente.next().getId();
    _cache[nome] = id;
    return SpreadsheetApp.openById(id);
  }
  var ss = SpreadsheetApp.create(nome);
  var sheet = ss.getActiveSheet();
  sheet.setName('Dados');
  if (headers && headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    SpreadsheetApp.flush();
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    SpreadsheetApp.flush();
  }
  var file = DriveApp.getFileById(ss.getId());
  pasta.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  _cache[nome] = ss.getId();
  return ss;
}

function _getOuCriarPlanilha(nome, headers) {
  var p = _getPlanilha(nome);
  if (p) return p;
  return _criarPlanilha(nome, headers);
}

function _sheet(ss) {
  var s = ss.getSheetByName('Dados');
  if (s) return s;
  return ss.getSheets()[0];
}

function _appendRow(sheet, row) {
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

function _readAll(ss) {
  var s = _sheet(ss);
  var lastRow = s.getLastRow();
  var lastCol = s.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { headers: [], rows: [] };
  var headers = s.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = s.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) val = val.toISOString();
      obj[headers[j]] = val;
    }
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function _atualizarLinha(sheet, colChaveNome, valorChave, objNovo, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var dados = sheet.getRange(1, 1, lastRow, headers.length).getValues();
  var idxChave = headers.indexOf(colChaveNome);
  if (idxChave < 0) return false;
  for (var r = 1; r < dados.length; r++) {
    if (String(dados[r][idxChave]) === String(valorChave)) {
      for (var c = 0; c < headers.length; c++) {
        var col = headers[c];
        if (objNovo.hasOwnProperty(col)) dados[r][c] = objNovo[col];
      }
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([dados[r]]);
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

// =====================================================================
//  TRAVA DE EMAIL PROPRIETARIO — impede execucao remota via Web App
//  Usada em funcoes de infraestrutura: initDatabase, criarAdmin, diagnosticarTudo
// =====================================================================
function _assertDono() {
  var emailAtivo = Session.getActiveUser().getEmail();
  var emailDono  = Session.getEffectiveUser().getEmail();
  if (!emailAtivo || emailAtivo !== emailDono) {
    throw new Error('Operacao permitida apenas para o proprietario do script.');
  }
}

// =====================================================================
//  INICIALIZACAO - EXECUTAR UMA VEZ NO EDITOR
// =====================================================================
function initDatabase() {
  _assertDono(); // Item 2 — trava de execucao remota
  _getPastaRaiz();
  _criarPlanilha(PLAN_USUARIOS,   HEADERS.usuarios);
  _criarPlanilha(PLAN_CONVITES,   HEADERS.convites);
  _criarPlanilha(PLAN_ESPACOS,    HEADERS.espacos);
  _criarPlanilha(PLAN_MEMBROS,    HEADERS.membros_espaco);
  _criarPlanilha(PLAN_CATEGORIAS, HEADERS.categorias);
  _criarPlanilha(PLAN_CARTEIRAS,  HEADERS.carteiras);
  _getPastaAnexos(null);
  Logger.log('Banco inicializado. Execute criarAdmin() em seguida.');
  return 'OK - Pasta e planilhas criadas. Execute criarAdmin() em seguida.';
}

function criarAdmin() {
  _assertDono(); // Item 2 — trava de execucao remota
  var ss = _getPlanilha(PLAN_USUARIOS);
  if (!ss) throw new Error('Execute initDatabase() primeiro.');
  var dados = _readAll(ss).rows;
  // Item 2 — verifica por perfil_sistema='admin', nao pelo login 'admin'
  // Evita criacao de usuario fantasma se o admin renomear seu login
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i].perfil_sistema).toLowerCase() === 'admin') {
      Logger.log('Ja existe um usuario com perfil admin. criarAdmin() abortado.');
      return 'Ja existe um usuario admin. Abortado.';
    }
  }
  var id   = Utilities.getUuid();
  var salt = Utilities.getUuid();
  var hash = _sha256('admin123' + salt);
  _appendRow(_sheet(ss), [id, 'Administrador', '', 'admin', hash, salt, 'admin', 'ativo', new Date()]);

  var ssEsp    = _getPlanilha(PLAN_ESPACOS);
  var espacoId = Utilities.getUuid();
  _appendRow(_sheet(ssEsp), [espacoId, 'Meu Espaco', id, new Date()]);

  var ssMem = _getPlanilha(PLAN_MEMBROS);
  _appendRow(_sheet(ssMem), [Utilities.getUuid(), espacoId, id, 'dono', new Date()]);

  _criarCategoriasPadrao(espacoId);
  _criarCarteirasPadrao(espacoId);

  Logger.log('Admin criado com sucesso. Acesse o sistema e altere sua senha no primeiro login.');
  return 'Admin criado. Faca login com o usuario "admin" e altere a senha imediatamente.';
}

function _criarCategoriasPadrao(espacoId) {
  var ss = _getPlanilha(PLAN_CATEGORIAS);
  if (!ss) return;
  var sheet = _sheet(ss);
  var cats = [
    ['Alimentação',   'despesa', '#ef4444', '🍽️'],
    ['Moradia',       'despesa', '#f97316', '🏠'],
    ['Transporte',    'despesa', '#eab308', '🚗'],
    ['Saúde',         'despesa', '#22c55e', '❤️'],
    ['Educação',      'despesa', '#3b82f6', '📚'],
    ['Lazer',         'despesa', '#a855f7', '🎮'],
    ['Roupas',        'despesa', '#ec4899', '👕'],
    ['Assinaturas',   'despesa', '#06b6d4', '🔄'],
    ['Outros (D)',    'despesa', '#6b7280', '📦'],
    ['Salário',       'receita', '#16a34a', '💵'],
    ['Freelance',     'receita', '#0d9488', '💼'],
    ['Investimento',  'receita', '#7c3aed', '📈'],
    ['Outros (R)',    'receita', '#6b7280', '📦']
  ];
  for (var i = 0; i < cats.length; i++) {
    _appendRow(sheet, [
      Utilities.getUuid(), espacoId, cats[i][0], cats[i][1], cats[i][2], cats[i][3], true
    ]);
  }
}

function _criarCarteirasPadrao(espacoId) {
  var ss = _getPlanilha(PLAN_CARTEIRAS);
  if (!ss) return;
  var sheet = _sheet(ss);
  var wallets = [
    ['Conta Corrente', 'corrente', 0],
    ['Poupança',       'poupanca', 0],
    ['Dinheiro',       'dinheiro', 0],
    ['Cartão de Crédito', 'cartao', 0]
  ];
  for (var i = 0; i < wallets.length; i++) {
    _appendRow(sheet, [
      Utilities.getUuid(), espacoId, wallets[i][0], wallets[i][1], wallets[i][2], true
    ]);
  }
}

// =====================================================================
//  SEGURANCA - SHA-256 COM SALT
//  Mesmo algoritmo da oficina, agora com salt por usuario
// =====================================================================
function _sha256(texto) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(texto),
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}

// =====================================================================
//  AUTORIZACAO — verifica se usuario pertence ao espaco
//  Item 1: cruza Session.getActiveUser() com userId do cliente
//  para evitar Identity Spoofing
// =====================================================================
function _assertMembro(userId, espacoId) {
  if (!userId || !espacoId) throw new Error('Acesso negado: parametros invalidos.');

  // Item 1 — valida identidade efetiva via Session (nao confia so no userId do cliente)
  try {
    var emailAtivo = Session.getActiveUser().getEmail();
    if (emailAtivo) {
      var ss = _getPlanilha(PLAN_USUARIOS);
      if (ss) {
        var rows = _readAll(ss).rows;
        var userEncontrado = rows.find(function(u) { return String(u.id) === String(userId); });
        if (userEncontrado && userEncontrado.email) {
          if (String(userEncontrado.email).toLowerCase() !== String(emailAtivo).toLowerCase()) {
            throw new Error('Acesso negado: identidade nao corresponde ao usuario autenticado.');
          }
        }
      }
    }
  } catch(e) {
    // Se o erro for de acesso negado, propaga; outros erros de Session sao ignorados
    if (String(e).indexOf('Acesso negado') >= 0) throw e;
  }

  var perfil = _getPerfilNoEspaco(userId, espacoId);
  if (!perfil) throw new Error('Acesso negado: usuario nao pertence a este espaco.');
  return perfil;
}

// =====================================================================
//  AUTENTICACAO com rate limiting (VULN 3)
//  Bloqueia apos 5 tentativas erradas por 5 minutos
// =====================================================================
var MAX_TENTATIVAS    = 5;
var BLOQUEIO_SEGUNDOS = 300; // 5 minutos

function login(loginInput, senhaInput) {
  try {
    var cache    = CacheService.getScriptCache();
    var chaveBlq = 'blq_' + String(loginInput).toLowerCase();
    var chaveCnt = 'cnt_' + String(loginInput).toLowerCase();

    // Verifica bloqueio ativo
    if (cache.get(chaveBlq)) {
      return { ok: false, msg: 'Conta temporariamente bloqueada. Tente novamente em 5 minutos.' };
    }

    var ss = _getPlanilha(PLAN_USUARIOS);
    if (!ss) return { ok: false, msg: 'Banco nao inicializado' };
    var dados = _readAll(ss).rows;

    for (var i = 0; i < dados.length; i++) {
      var u = dados[i];
      if (String(u.login).toLowerCase() !== String(loginInput).toLowerCase()) continue;
      if (String(u.status) !== 'ativo') return { ok: false, msg: 'Usuario inativo' };

      var hash = _sha256(String(senhaInput) + String(u.salt));
      if (String(u.senha_hash) !== hash) {
        // Incrementa contador de tentativas falhas
        var tentativas = Number(cache.get(chaveCnt) || 0) + 1;
        if (tentativas >= MAX_TENTATIVAS) {
          cache.put(chaveBlq, '1', BLOQUEIO_SEGUNDOS);
          cache.remove(chaveCnt);
          return { ok: false, msg: 'Muitas tentativas incorretas. Conta bloqueada por 5 minutos.' };
        }
        cache.put(chaveCnt, String(tentativas), BLOQUEIO_SEGUNDOS);
        break;
      }

      // Login bem-sucedido: limpa contadores
      cache.remove(chaveBlq);
      cache.remove(chaveCnt);

      var espacos   = _getEspacosDoUsuario(u.id);
      var primAcesso = (String(u.login).toLowerCase() === 'admin'
                        && String(u.nome) === 'Administrador');
      return {
        ok: true,
        primeiro_acesso: primAcesso,
        user: { id: u.id, nome: u.nome, email: u.email, login: u.login, perfil: u.perfil_sistema },
        espacos: espacos
      };
    }
    return { ok: false, msg: 'Login ou senha invalidos' };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

/**
 * Atualiza nome e, opcionalmente, senha do usuário.
 * Usado tanto no primeiro acesso (admin) quanto em "Minha conta".
 * Se senhaAtual e senhaNova forem null, altera só o nome.
 */
function atualizarPerfil(userId, novoNome, senhaAtual, senhaNova) {
  // C3 — Valida que o ator declarado corresponde à sessão Google ativa
  try {
    var _emailAtivo = Session.getActiveUser().getEmail();
    if (_emailAtivo) {
      var _ssUs = _getPlanilha(PLAN_USUARIOS);
      if (_ssUs) {
        var _ator = _readAll(_ssUs).rows.find(function(u) {
          return String(u.id) === String(userId);
        });
        if (_ator && _ator.email &&
            String(_ator.email).toLowerCase() !== String(_emailAtivo).toLowerCase()) {
          return { ok: false, msg: 'Acesso negado: identidade inválida.' };
        }
      }
    }
  } catch(_e) {
    if (String(_e).indexOf('Acesso negado') >= 0) return { ok: false, msg: String(_e) };
  }
  try {
    var ss = _getPlanilha(PLAN_USUARIOS);
    if (!ss) return { ok: false, msg: 'Banco nao inicializado' };
    var sheet   = _sheet(ss);
    var headers = HEADERS.usuarios;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, msg: 'Usuario nao encontrado' };

    var dados    = sheet.getRange(1, 1, lastRow, headers.length).getValues();
    var idxId    = headers.indexOf('id');
    var idxNome  = headers.indexOf('nome');
    var idxHash  = headers.indexOf('senha_hash');
    var idxSalt  = headers.indexOf('salt');
    var idxLogin = headers.indexOf('login');

    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxId]) !== String(userId)) continue;

      // Valida senha atual se for trocar
      if (senhaAtual !== null && senhaAtual !== undefined && senhaAtual !== '') {
        if (!senhaNova || String(senhaNova).length < 6) {
          return { ok: false, msg: 'Nova senha precisa ter ao menos 6 caracteres' };
        }
        var salt = String(dados[r][idxSalt]);
        var hashAtual = _sha256(String(senhaAtual) + salt);
        if (String(dados[r][idxHash]) !== hashAtual) {
          return { ok: false, msg: 'Senha atual incorreta' };
        }
        // Gera novo salt e hash
        var novoSalt = Utilities.getUuid();
        var novoHash = _sha256(String(senhaNova) + novoSalt);
        sheet.getRange(r + 1, idxHash + 1).setValue(novoHash);
        sheet.getRange(r + 1, idxSalt + 1).setValue(novoSalt);
      }

      // Atualiza nome
      if (novoNome) {
        sheet.getRange(r + 1, idxNome + 1).setValue(novoNome);
      }

      SpreadsheetApp.flush();
      return { ok: true, novo_login: String(dados[r][idxLogin]) };
    }
    return { ok: false, msg: 'Usuario nao encontrado' };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  SEGURANCA — TOKEN DE CONVITE COM HMAC (VULN 7)
//  O token e assinado com um segredo interno definido em PropertiesService.
//  Para configurar: execute setTokenSecret() UMA VEZ no editor.
// =====================================================================
function setTokenSecret() {
  var segredo = Utilities.getUuid() + Utilities.getUuid(); // 72 chars aleatorios
  PropertiesService.getScriptProperties().setProperty('TOKEN_SECRET', segredo);
  Logger.log('TOKEN_SECRET configurado com sucesso.');
  return 'OK: segredo configurado.';
}

function _getTokenSecret() {
  var s = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!s) {
    // Gera e persiste automaticamente se ainda nao existir
    s = Utilities.getUuid() + Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty('TOKEN_SECRET', s);
  }
  return s;
}

function _gerarTokenConvite(email, espacoId) {
  var base    = Utilities.getUuid();
  var segredo = _getTokenSecret();
  var payload = base + String(email).toLowerCase() + String(espacoId);
  var sig     = _sha256(payload + segredo).substring(0, 16);
  return base + '-' + sig;
}

function _validarAssinaturaToken(token, email, espacoId) {
  if (!token || token.length < 37) return false;
  var partes  = token.split('-');
  // UUID tem 5 grupos; o 6o grupo e nossa assinatura
  if (partes.length < 6) return false;
  var sig     = partes[partes.length - 1];
  var base    = partes.slice(0, partes.length - 1).join('-');
  var segredo = _getTokenSecret();
  var payload = base + String(email).toLowerCase() + String(espacoId);
  var sigEsperada = _sha256(payload + segredo).substring(0, 16);
  return sig === sigEsperada;
}

// =====================================================================
//  SISTEMA DE CONVITES POR EMAIL
// =====================================================================

// =====================================================================
//  TESTE DE EMAIL — execute no editor para verificar se o envio funciona
//  Substitua 'seu@email.com' pelo seu proprio email antes de executar
// =====================================================================
function testarEnvioEmail() {
  try {
    var destinatario = Session.getActiveUser().getEmail();
    MailApp.sendEmail({
      to: destinatario,
      subject: '✅ AZ² Finance — Teste de email',
      htmlBody:
        '<div style="font-family:sans-serif;padding:24px;">' +
        '<h2 style="color:#1e40af;">AZ² Finance 💰</h2>' +
        '<p>Se você recebeu este email, o envio está funcionando corretamente.</p>' +
        '<p style="color:#6b7280;font-size:13px;">Enviado em: ' + new Date().toLocaleString() + '</p>' +
        '</div>'
    });
    Logger.log('Email de teste enviado para: ' + destinatario);
    return 'OK — email enviado para ' + destinatario;
  } catch (e) {
    Logger.log('ERRO ao enviar email de teste: ' + String(e));
    return 'ERRO: ' + String(e);
  }
}

/**
 * Envia convite para um email. Apenas donos/admins do espaco podem convidar.
 * Gera token unico, salva em planilha e dispara email com link de aceite.
 */
function enviarConvite(email, espacoId, convidadoPorId) {
  // C3 — Valida que o ator declarado corresponde à sessão Google ativa
  try {
    var _emailAtivo = Session.getActiveUser().getEmail();
    if (_emailAtivo) {
      var _ssUs = _getPlanilha(PLAN_USUARIOS);
      if (_ssUs) {
        var _ator = _readAll(_ssUs).rows.find(function(u) {
          return String(u.id) === String(convidadoPorId);
        });
        if (_ator && _ator.email &&
            String(_ator.email).toLowerCase() !== String(_emailAtivo).toLowerCase()) {
          return { ok: false, msg: 'Acesso negado: identidade inválida.' };
        }
      }
    }
  } catch(_e) {
    if (String(_e).indexOf('Acesso negado') >= 0) return { ok: false, msg: String(_e) };
  }
  try {
    if (!email || !espacoId) return { ok: false, msg: 'Email e espaco sao obrigatorios' };

    // Verifica se quem convida e dono/admin do espaco
    var perfil = _getPerfilNoEspaco(convidadoPorId, espacoId);
    if (perfil !== 'dono' && perfil !== 'admin') {
      return { ok: false, msg: 'Apenas donos ou admins podem convidar' };
    }

    // Verifica se ja e membro
    var membros = _readAll(_getOuCriarPlanilha(PLAN_MEMBROS, HEADERS.membros_espaco)).rows;
    for (var m = 0; m < membros.length; m++) {
      if (String(membros[m].espaco_id) === String(espacoId)) {
        var uMem = _buscarUsuarioPorId(membros[m].usuario_id);
        if (uMem && String(uMem.email).toLowerCase() === String(email).toLowerCase()) {
          return { ok: false, msg: 'Este email ja e membro do espaco' };
        }
      }
    }

    // Invalida convites anteriores pendentes para o mesmo email+espaco
    _cancelarConvitesPendentes(email, espacoId);

    var token  = _gerarTokenConvite(email, espacoId); // VULN 7 — token com HMAC
    var ssConv = _getOuCriarPlanilha(PLAN_CONVITES, HEADERS.convites);
    _appendRow(_sheet(ssConv), [
      Utilities.getUuid(), email, token, espacoId, 'pendente', convidadoPorId, new Date(), ''
    ]);

    // Monta URL do convite
    var urlBase     = ScriptApp.getService().getUrl();
    var linkConvite = urlBase + '?convite=' + token;
    var nomeEspaco  = _getNomeEspaco(espacoId);

    // Verifica cota de emails disponivel antes de tentar enviar
    var cotaRestante = MailApp.getRemainingDailyQuota();
    Logger.log('Cota de emails restante: ' + cotaRestante);
    if (cotaRestante <= 0) {
      return { ok: false, msg: 'Cota diaria de emails esgotada. Tente novamente amanha.' };
    }

    // Envia email
    MailApp.sendEmail({
      to: email,
      subject: 'Convite para o AZ² Finance — ' + nomeEspaco,
      htmlBody:
        '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">' +
        '<h2 style="color:#1e40af;">AZ² Finance 💰</h2>' +
        '<p>Você foi convidado para participar do espaço financeiro <strong>' + nomeEspaco + '</strong>.</p>' +
        '<p>Clique no botão abaixo para aceitar o convite e criar sua senha:</p>' +
        '<a href="' + linkConvite + '" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Aceitar convite</a>' +
        '<p style="color:#6b7280;font-size:13px;">Se você não esperava este convite, ignore este email.<br>Link válido por 7 dias.</p>' +
        '</div>'
    });

    Logger.log('Convite enviado para: ' + email);
    return { ok: true, msg: 'Convite enviado para ' + email };
  } catch (e) {
    Logger.log('ERRO enviarConvite: ' + String(e));
    return { ok: false, msg: 'Erro ao enviar email: ' + String(e) };
  }
}

/**
 * Valida o token do convite (chamado quando a pagina abre com ?convite=TOKEN).
 * Retorna dados do convite para a UI mostrar a tela de aceite.
 */
function validarToken(token) {
  try {
    if (!token) return { ok: false, msg: 'Token invalido' };
    var ss = _getPlanilha(PLAN_CONVITES);
    if (!ss) return { ok: false, msg: 'Banco nao inicializado' };
    var rows = _readAll(ss).rows;
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i];
      if (String(c.token) !== String(token)) continue;
      if (String(c.status) !== 'pendente') return { ok: false, msg: 'Convite ja utilizado ou expirado' };
      // Verifica validade de 7 dias
      var enviado = new Date(c.data_envio);
      var agora   = new Date();
      var diff    = (agora - enviado) / (1000 * 60 * 60 * 24);
      if (diff > 7) return { ok: false, msg: 'Convite expirado (validade 7 dias)' };
      // VULN 7 — verifica assinatura HMAC do token
      if (!_validarAssinaturaToken(token, c.email, c.espaco_id)) {
        return { ok: false, msg: 'Token invalido ou adulterado' };
      }
      var nomeEspaco = _getNomeEspaco(c.espaco_id);
      return { ok: true, email: c.email, espaco_id: c.espaco_id, nome_espaco: nomeEspaco, token: token };
    }
    return { ok: false, msg: 'Convite nao encontrado' };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

/**
 * Aceita convite: cria ou vincula usuario ao espaco.
 * Chamado quando o usuario preenche nome+senha na tela de aceite.
 */
function aceitarConvite(token, nome, senha) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!token || !nome || !senha) return { ok: false, msg: 'Dados incompletos' };
    if (String(senha).length < 6) return { ok: false, msg: 'Senha precisa ter ao menos 6 caracteres' };

    var validacao = validarToken(token);
    if (!validacao.ok) return validacao;

    var email    = validacao.email;
    var espacoId = validacao.espaco_id;

    var ssUs         = _getOuCriarPlanilha(PLAN_USUARIOS, HEADERS.usuarios);
    var sheetUs      = _sheet(ssUs);
    var usuariosExist = _readAll(ssUs).rows;

    var usuarioExistente = null;
    for (var u = 0; u < usuariosExist.length; u++) {
      if (String(usuariosExist[u].email).toLowerCase() === String(email).toLowerCase()) {
        usuarioExistente = usuariosExist[u];
        break;
      }
    }

    var userId;
    if (usuarioExistente) {
      userId = usuarioExistente.id;
    } else {
      userId   = Utilities.getUuid();
      var salt = Utilities.getUuid();
      var hash = _sha256(String(senha) + salt);
      _appendRow(sheetUs, [userId, nome, email, email, hash, salt, 'membro', 'ativo', new Date()]);
    }

    var ssMem = _getOuCriarPlanilha(PLAN_MEMBROS, HEADERS.membros_espaco);
    _appendRow(_sheet(ssMem), [Utilities.getUuid(), espacoId, userId, 'membro', new Date()]);

    var ssConv  = _getPlanilha(PLAN_CONVITES);
    var shConv  = _sheet(ssConv);
    var hConv   = HEADERS.convites;
    var lastRow = shConv.getLastRow();
    var dados   = shConv.getRange(1, 1, lastRow, hConv.length).getValues();
    var idxToken  = hConv.indexOf('token');
    var idxStatus = hConv.indexOf('status');
    var idxAceite = hConv.indexOf('data_aceite');
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxToken]) === String(token)) {
        shConv.getRange(r + 1, idxStatus + 1).setValue('aceito');
        shConv.getRange(r + 1, idxAceite + 1).setValue(new Date());
        SpreadsheetApp.flush();
        break;
      }
    }

    var espacos = _getEspacosDoUsuario(userId);
    return {
      ok: true,
      user: { id: userId, nome: nome, email: email, login: email, perfil: 'membro' },
      espacos: espacos
    };
  } catch (e) {
    Logger.log('aceitarConvite ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  } finally {
    lock.releaseLock();
  }
}

function _cancelarConvitesPendentes(email, espacoId) {
  try {
    var ss = _getPlanilha(PLAN_CONVITES);
    if (!ss) return;
    var sheet = _sheet(ss);
    var h = HEADERS.convites;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var dados = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxEmail  = h.indexOf('email');
    var idxEspaco = h.indexOf('espaco_id');
    var idxStatus = h.indexOf('status');
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxEmail]).toLowerCase() === String(email).toLowerCase()
          && String(dados[r][idxEspaco]) === String(espacoId)
          && String(dados[r][idxStatus]) === 'pendente') {
        sheet.getRange(r + 1, idxStatus + 1).setValue('cancelado');
      }
    }
    SpreadsheetApp.flush();
  } catch (e) { /* silencioso */ }
}

// =====================================================================
//  ESPACOS - GERENCIAMENTO
// =====================================================================
function criarEspaco(nome, donoId) {
  // C3 — Valida que o ator declarado corresponde à sessão Google ativa
  try {
    var _emailAtivo = Session.getActiveUser().getEmail();
    if (_emailAtivo) {
      var _ssUs = _getPlanilha(PLAN_USUARIOS);
      if (_ssUs) {
        var _ator = _readAll(_ssUs).rows.find(function(u) {
          return String(u.id) === String(donoId);
        });
        if (_ator && _ator.email &&
            String(_ator.email).toLowerCase() !== String(_emailAtivo).toLowerCase()) {
          return { ok: false, msg: 'Acesso negado: identidade inválida.' };
        }
      }
    }
  } catch(_e) {
    if (String(_e).indexOf('Acesso negado') >= 0) return { ok: false, msg: String(_e) };
  }
  try {
    var ss  = _getOuCriarPlanilha(PLAN_ESPACOS, HEADERS.espacos);
    var id  = Utilities.getUuid();
    _appendRow(_sheet(ss), [id, nome, donoId, new Date()]);

    var ssMem = _getOuCriarPlanilha(PLAN_MEMBROS, HEADERS.membros_espaco);
    _appendRow(_sheet(ssMem), [Utilities.getUuid(), id, donoId, 'dono', new Date()]);

    _criarCategoriasPadrao(id);
    _criarCarteirasPadrao(id);

    return { ok: true, espaco: { id: id, nome: nome, dono_id: donoId } };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

function _getNomeEspaco(espacoId) {
  try {
    var ss = _getPlanilha(PLAN_ESPACOS);
    if (!ss) return 'Espaço';
    var rows = _readAll(ss).rows;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(espacoId)) return rows[i].nome;
    }
    return 'Espaço';
  } catch (e) { return 'Espaço'; }
}

function _getEspacosDoUsuario(userId) {
  try {
    var ssMem = _getPlanilha(PLAN_MEMBROS);
    if (!ssMem) return [];
    var membros = _readAll(ssMem).rows;
    var ssEsp   = _getPlanilha(PLAN_ESPACOS);
    var espacos = ssEsp ? _readAll(ssEsp).rows : [];
    var resultado = [];
    for (var m = 0; m < membros.length; m++) {
      if (String(membros[m].usuario_id) !== String(userId)) continue;
      for (var e = 0; e < espacos.length; e++) {
        if (String(espacos[e].id) === String(membros[m].espaco_id)) {
          resultado.push({
            id: espacos[e].id,
            nome: espacos[e].nome,
            perfil: membros[m].perfil
          });
          break;
        }
      }
    }
    return resultado;
  } catch (e) { return []; }
}

function _getPerfilNoEspaco(userId, espacoId) {
  try {
    var ss = _getPlanilha(PLAN_MEMBROS);
    if (!ss) return null;
    var rows = _readAll(ss).rows;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].usuario_id) === String(userId)
          && String(rows[i].espaco_id) === String(espacoId)) {
        return rows[i].perfil;
      }
    }
    return null;
  } catch (e) { return null; }
}

function listarMembrosEspaco(espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var ssMem = _getOuCriarPlanilha(PLAN_MEMBROS, HEADERS.membros_espaco);
    var membros = _readAll(ssMem).rows.filter(function(m) {
      return String(m.espaco_id) === String(espacoId);
    });
    var resultado = [];
    for (var i = 0; i < membros.length; i++) {
      var u = _buscarUsuarioPorId(membros[i].usuario_id);
      if (u) {
        resultado.push({
          usuario_id: u.id,
          nome: u.nome,
          email: u.email,
          perfil: membros[i].perfil,
          data_entrada: membros[i].data_entrada
        });
      }
    }
    return { ok: true, membros: resultado };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

function removerMembro(membroId, espacoId, solicitanteId) {
  // C3 — Valida que o ator declarado corresponde à sessão Google ativa
  try {
    var _emailAtivo = Session.getActiveUser().getEmail();
    if (_emailAtivo) {
      var _ssUs = _getPlanilha(PLAN_USUARIOS);
      if (_ssUs) {
        var _ator = _readAll(_ssUs).rows.find(function(u) {
          return String(u.id) === String(solicitanteId);
        });
        if (_ator && _ator.email &&
            String(_ator.email).toLowerCase() !== String(_emailAtivo).toLowerCase()) {
          return { ok: false, msg: 'Acesso negado: identidade inválida.' };
        }
      }
    }
  } catch(_e) {
    if (String(_e).indexOf('Acesso negado') >= 0) return { ok: false, msg: String(_e) };
  }
  try {
    var perfil = _getPerfilNoEspaco(solicitanteId, espacoId);
    if (perfil !== 'dono') return { ok: false, msg: 'Apenas o dono pode remover membros' };
    if (membroId === solicitanteId) return { ok: false, msg: 'O dono nao pode se remover' };
    var ss    = _getPlanilha(PLAN_MEMBROS);
    var sheet = _sheet(ss);
    var h     = HEADERS.membros_espaco;
    var lastRow = sheet.getLastRow();
    var dados   = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxUser  = h.indexOf('usuario_id');
    var idxEspaco = h.indexOf('espaco_id');
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxUser]) === String(membroId)
          && String(dados[r][idxEspaco]) === String(espacoId)) {
        sheet.deleteRow(r + 1);
        SpreadsheetApp.flush();
        return { ok: true };
      }
    }
    return { ok: false, msg: 'Membro nao encontrado' };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  CATEGORIAS
// =====================================================================
function salvarCategoria(cat) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    _assertMembro(cat.usuario_id || cat.criado_por, cat.espaco_id); // C2 — autorização de escrita
    var ss    = _getOuCriarPlanilha(PLAN_CATEGORIAS, HEADERS.categorias);
    var sheet = _sheet(ss);
    if (cat.id) {
      _atualizarLinha(sheet, 'id', cat.id, cat, HEADERS.categorias);
    } else {
      cat.id = Utilities.getUuid();
      _appendRow(sheet, [cat.id, cat.espaco_id, cat.nome, cat.tipo, cat.cor || '#6b7280', cat.icone || '', true]);
    }
    SpreadsheetApp.flush();
    return { ok: true, categoria: cat };
  } catch (e) {
    Logger.log('salvarCategoria ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  } finally {
    lock.releaseLock();
  }
}

function listarCategorias(espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var ss   = _getOuCriarPlanilha(PLAN_CATEGORIAS, HEADERS.categorias);
    var rows = _readAll(ss).rows.filter(function(c) {
      return String(c.espaco_id) === String(espacoId) && c.ativa !== false && c.ativa !== 'false';
    });
    return { ok: true, rows: rows };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  CARTEIRAS
// =====================================================================
function salvarCarteira(wallet) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    _assertMembro(wallet.usuario_id, wallet.espaco_id); // C2 — autorização de escrita
    var ss    = _getOuCriarPlanilha(PLAN_CARTEIRAS, HEADERS.carteiras);
    var sheet = _sheet(ss);
    if (wallet.id) {
      _atualizarLinha(sheet, 'id', wallet.id, wallet, HEADERS.carteiras);
    } else {
      wallet.id = Utilities.getUuid();
      _appendRow(sheet, [
        wallet.id, wallet.espaco_id, wallet.nome,
        wallet.tipo || 'corrente', Number(wallet.saldo_inicial) || 0, true
      ]);
    }
    SpreadsheetApp.flush();
    return { ok: true, carteira: wallet };
  } catch (e) {
    Logger.log('salvarCarteira ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  } finally {
    lock.releaseLock();
  }
}

function listarCarteiras(espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var ss   = _getOuCriarPlanilha(PLAN_CARTEIRAS, HEADERS.carteiras);
    var rows = _readAll(ss).rows.filter(function(w) {
      return String(w.espaco_id) === String(espacoId) && w.ativa !== false && w.ativa !== 'false';
    });
    return { ok: true, rows: rows };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  LANCAMENTOS - PLANILHA MENSAL (padrao da oficina)
// =====================================================================
function _nomePlanilhaLanc(data, espacoId) {
  var d  = data ? new Date(data) : new Date();
  var mes = d.getMonth() + 1;
  var ano = d.getFullYear();
  var mm  = mes < 10 ? '0' + mes : '' + mes;
  // Usa primeiros 8 chars do espacoId para nao ultrapassar limite de nome do Drive
  var eid = String(espacoId).replace(/-/g, '').substring(0, 8);
  return 'lanc_' + eid + '_' + mm + '_' + ano;
}

/**
 * Salva lancamento. Se parcela_total > 1, cria N linhas automaticamente,
 * uma por mes de vencimento, com mesmo grupo_id.
 *
 * Parametros esperados em lanc:
 *   tipo           'pagar' | 'receber'
 *   descricao
 *   valor          valor POR PARCELA (usuario digita a parcela, nao o total)
 *   categoria_id
 *   carteira_id
 *   data_vencimento  data do 1o vencimento (ISO string)
 *   parcela_total  1 = avista; N = parcelado
 *   recorrencia    'nenhuma' | 'mensal' | 'anual'
 *   espaco_id
 *   criado_por     usuario_id
 *   anexo          { dataUrl, mime, nome } (opcional)
 */
function salvarLancamento(lanc) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    _assertMembro(lanc.criado_por, lanc.espaco_id);
    var n         = Math.max(1, Number(lanc.parcela_total) || 1); // declarado ANTES de usar
    var grupoId   = n > 1 ? ('G' + Utilities.getUuid().replace(/-/g, '').substring(0, 12)) : '';
    var valorParc = Math.round((Number(lanc.valor) || 0) * 100) / 100;
    var dataBase  = lanc.data_vencimento ? new Date(lanc.data_vencimento) : new Date();
    var anexoUrl  = '';

    if (lanc.anexo && lanc.anexo.dataUrl) {
      anexoUrl = _salvarAnexo(lanc.espaco_id, lanc.anexo);
    }

    for (var i = 0; i < n; i++) {
      var dataVenc = new Date(dataBase.getFullYear(), dataBase.getMonth() + i, dataBase.getDate());
      var nomePlan = _nomePlanilhaLanc(dataVenc, lanc.espaco_id);
      var ss       = _getOuCriarPlanilha(nomePlan, HEADERS.lancamentos);
      var id       = 'L' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);

      _appendRow(_sheet(ss), [
        id, lanc.espaco_id, lanc.tipo || 'pagar', lanc.descricao || '',
        valorParc, lanc.categoria_id || '', lanc.carteira_id || '',
        new Date(), dataVenc, '', 'pendente', lanc.recorrencia || 'nenhuma',
        grupoId, n > 1 ? (i + 1) : '', n > 1 ? n : '',
        anexoUrl, lanc.criado_por || '', new Date()
      ]);
    }
    SpreadsheetApp.flush();
    return { ok: true, parcelas: n, grupo_id: grupoId };
  } catch (e) {
    Logger.log('salvarLancamento ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lista lancamentos de um mes/ano para um espaco.
 * Retorna as linhas + resumo financeiro.
 */
function listarLancamentosMes(mes, ano, espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var data     = new Date(ano, mes - 1, 1);
    var nomePlan = _nomePlanilhaLanc(data, espacoId);
    var ss       = _getPlanilha(nomePlan);
    if (!ss) {
      return { ok: true, rows: [], resumo: { a_pagar: 0, a_receber: 0, pago: 0, recebido: 0, saldo: 0 } };
    }
    var rows = _readAll(ss).rows.filter(function(r) {
      return String(r.espaco_id) === String(espacoId);
    });

    var resumo = { a_pagar: 0, a_receber: 0, pago: 0, recebido: 0 };
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var v = Number(r.valor) || 0;
      var st = String(r.status);
      var tipo = String(r.tipo);

      // Marca atrasados
      if (st === 'pendente') {
        var venc = r.data_vencimento ? new Date(r.data_vencimento) : null;
        if (venc) {
          venc.setHours(0, 0, 0, 0);
          if (venc < hoje) rows[i].status = 'atrasado';
        }
      }

      if (tipo === 'pagar') {
        if (st === 'pago') resumo.pago += v;
        else resumo.a_pagar += v;
      } else {
        if (st === 'pago') resumo.recebido += v;
        else resumo.a_receber += v;
      }
    }

    resumo.a_pagar   = Math.round(resumo.a_pagar   * 100) / 100;
    resumo.a_receber = Math.round(resumo.a_receber * 100) / 100;
    resumo.pago      = Math.round(resumo.pago       * 100) / 100;
    resumo.recebido  = Math.round(resumo.recebido   * 100) / 100;
    resumo.saldo     = Math.round((resumo.recebido - resumo.pago) * 100) / 100;

    return { ok: true, rows: rows, resumo: resumo };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

/**
 * Edita um lançamento existente — atualiza campos sem criar novo registro.
 * Não altera grupo_id, parcela_num, parcela_total (estrutura de parcelamento intacta).
 */
function editarLancamento(idLanc, dados, mes, ano, espacoId, userId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    _assertMembro(userId, espacoId);
    var data     = new Date(ano, mes - 1, 1);
    var nomePlan = _nomePlanilhaLanc(data, espacoId);
    var ss       = _getPlanilha(nomePlan);
    if (!ss) return { ok: false, msg: 'Planilha do mes nao encontrada' };
    var sheet    = _sheet(ss);
    var h        = HEADERS.lancamentos;
    var lastRow  = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, msg: 'Lancamento nao encontrado' };
    var registros = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxId    = h.indexOf('id');
    var idxTipo  = h.indexOf('tipo');
    var idxDesc  = h.indexOf('descricao');
    var idxValor = h.indexOf('valor');
    var idxCat   = h.indexOf('categoria_id');
    var idxWal   = h.indexOf('carteira_id');
    var idxVenc  = h.indexOf('data_vencimento');
    var idxRec   = h.indexOf('recorrencia');
    for (var r = 1; r < registros.length; r++) {
      if (String(registros[r][idxId]) !== String(idLanc)) continue;
      if (dados.tipo)            sheet.getRange(r+1, idxTipo+1).setValue(dados.tipo);
      if (dados.descricao)       sheet.getRange(r+1, idxDesc+1).setValue(dados.descricao);
      if (dados.valor)           sheet.getRange(r+1, idxValor+1).setValue(Number(dados.valor));
      if (dados.categoria_id)    sheet.getRange(r+1, idxCat+1).setValue(dados.categoria_id);
      if (dados.carteira_id)     sheet.getRange(r+1, idxWal+1).setValue(dados.carteira_id);
      if (dados.data_vencimento) sheet.getRange(r+1, idxVenc+1).setValue(new Date(dados.data_vencimento));
      if (dados.recorrencia)     sheet.getRange(r+1, idxRec+1).setValue(dados.recorrencia);
      SpreadsheetApp.flush();
      return { ok: true };
    }
    return { ok: false, msg: 'Lancamento nao encontrado' };
  } catch (e) {
    Logger.log('editarLancamento ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  } finally {
    lock.releaseLock();
  }
}

function marcarLancamento(idLanc, mes, ano, espacoId, novoStatus, userId) {
  try {
    _assertMembro(userId, espacoId);
    var data     = new Date(ano, mes - 1, 1);
    var nomePlan = _nomePlanilhaLanc(data, espacoId);
    var ss       = _getPlanilha(nomePlan);
    if (!ss) return { ok: false, msg: 'Planilha do mes nao encontrada' };
    var sheet   = _sheet(ss);
    var h       = HEADERS.lancamentos;
    var lastRow = sheet.getLastRow();
    var dados   = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxId   = h.indexOf('id');
    var idxSt   = h.indexOf('status');
    var idxPag  = h.indexOf('data_pagamento');
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxId]) !== String(idLanc)) continue;
      sheet.getRange(r + 1, idxSt + 1).setValue(novoStatus);
      sheet.getRange(r + 1, idxPag + 1).setValue(novoStatus === 'pago' ? new Date() : '');
      SpreadsheetApp.flush();
      return { ok: true };
    }
    return { ok: false, msg: 'Lancamento nao encontrado' };
  } catch (e) {
    Logger.log('marcarLancamento ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  }
}

function excluirLancamento(idLanc, mes, ano, espacoId, excluirGrupo, userId) {
  try {
    _assertMembro(userId, espacoId);
    var data     = new Date(ano, mes - 1, 1);
    var nomePlan = _nomePlanilhaLanc(data, espacoId);
    var ss       = _getPlanilha(nomePlan);
    if (!ss) return { ok: false, msg: 'Planilha nao encontrada' };
    var sheet   = _sheet(ss);
    var h       = HEADERS.lancamentos;
    var lastRow = sheet.getLastRow();
    var dados   = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxId    = h.indexOf('id');
    var idxGrupo = h.indexOf('grupo_id');
    var idxNum   = h.indexOf('parcela_num');
    var grupoId  = '';
    var parcelaNum = 0;
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxId]) === String(idLanc)) {
        grupoId    = String(dados[r][idxGrupo]);
        parcelaNum = Number(dados[r][idxNum]) || 0;
        sheet.deleteRow(r + 1);
        SpreadsheetApp.flush();
        break;
      }
    }
    if (excluirGrupo && grupoId) {
      _excluirProximasParcelas(grupoId, parcelaNum, mes, ano, espacoId);
    }
    return { ok: true };
  } catch (e) {
    Logger.log('excluirLancamento ERRO: ' + String(e));
    return { ok: false, msg: 'Erro interno ao processar a requisicao.' };
  }
}

function _excluirProximasParcelas(grupoId, parcelaNum, mesBase, anoBase, espacoId) {
  try {
    var hoje = new Date(anoBase, mesBase - 1, 1);
    for (var m = 1; m <= 24; m++) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth() + m, 1);
      var nomePlan = _nomePlanilhaLanc(d, espacoId);
      var ss = _getPlanilha(nomePlan);
      if (!ss) continue;
      var sheet = _sheet(ss);
      var h = HEADERS.lancamentos;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;
      var dados = sheet.getRange(1, 1, lastRow, h.length).getValues();
      var idxGrupo = h.indexOf('grupo_id');
      var idxNum   = h.indexOf('parcela_num');
      // Percorre de baixo pra cima para nao deslocar indices ao deletar
      for (var r = dados.length - 1; r >= 1; r--) {
        if (String(dados[r][idxGrupo]) === String(grupoId)
            && Number(dados[r][idxNum]) > parcelaNum) {
          sheet.deleteRow(r + 1);
        }
      }
      SpreadsheetApp.flush();
    }
  } catch (e) { /* silencioso */ }
}

// =====================================================================
//  DASHBOARD - RESUMO DO MES
// =====================================================================
function dashboardResumo(mes, ano, espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var resultado = listarLancamentosMes(mes, ano, espacoId, userId); // C1 — repassa userId
    if (!resultado.ok) return { ok: false, msg: resultado.msg };

    var rows = resultado.rows;
    var resumo = resultado.resumo;
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Proximos vencimentos (ate 7 dias) e atrasados
    var proximos = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.status === 'pago') continue;
      var venc = r.data_vencimento ? new Date(r.data_vencimento) : null;
      if (!venc) continue;
      venc.setHours(0, 0, 0, 0);
      var diff = Math.round((venc - hoje) / (1000 * 60 * 60 * 24));
      if (diff <= 7) {
        proximos.push({
          id: r.id, descricao: r.descricao, valor: r.valor, tipo: r.tipo,
          data_vencimento: r.data_vencimento, status: r.status,
          dias: diff, categoria_id: r.categoria_id,
          parcela_num: r.parcela_num, parcela_total: r.parcela_total
        });
      }
    }
    proximos.sort(function(a, b) { return a.dias - b.dias; });

    return {
      ok: true,
      resumo: resumo,
      proximos: proximos.slice(0, 5),
      mes: mes, ano: ano
    };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  CARGA INICIAL - UMA UNICA CHAMADA (economiza requests)
// =====================================================================
function loadAllData(espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var hoje = new Date();
    var mes  = hoje.getMonth() + 1;
    var ano  = hoje.getFullYear();

    var cats    = listarCategorias(espacoId, userId);    // C1 — repassa userId
    var wallets = listarCarteiras(espacoId, userId);     // C1 — repassa userId
    var dash    = dashboardResumo(mes, ano, espacoId, userId); // C1 — repassa userId
    var membros = listarMembrosEspaco(espacoId, userId); // C1 — repassa userId

    return {
      ok: true,
      categorias: cats.ok ? cats.rows : [],
      carteiras:  wallets.ok ? wallets.rows : [],
      dashboard:  dash.ok ? dash : {},
      membros:    membros.ok ? membros.membros : [],
      mes: mes, ano: ano
    };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  UPLOAD DE ANEXOS (foto ou PDF do comprovante)
//  VULN 4 corrigida: arquivos mantidos privados, acesso via função autenticada
// =====================================================================
function _salvarAnexo(espacoId, anexo) {
  try {
    var pasta = _getPastaAnexos(espacoId);
    if (!anexo || !anexo.dataUrl) return '';
    var partes    = anexo.dataUrl.split(',');
    if (partes.length < 2) return '';
    var matchMime = partes[0].match(/data:(.*?);base64/);
    var mime      = (matchMime && matchMime[1]) || 'image/jpeg';
    var bytes     = Utilities.base64Decode(partes[1]);
    var nome      = anexo.nome || ('anexo_' + new Date().getTime());
    var blob      = Utilities.newBlob(bytes, mime, nome);
    var file      = pasta.createFile(blob);
    // Arquivo mantido PRIVADO — não chama setSharing
    // Retorna apenas o ID; acesso via getAnexo() autenticado
    return file.getId();
  } catch (e) {
    return '';
  }
}

/**
 * Serve o conteúdo de um anexo em base64 para o frontend autenticado.
 * O frontend converte para blob e abre localmente — o arquivo nunca é público.
 */
function getAnexo(fileId, userId, espacoId) {
  try {
    _assertMembro(userId, espacoId);
    if (!fileId) return { ok: false, msg: 'ID do arquivo nao informado' };

    // C4 — Verifica que o arquivo pertence à pasta do espaço informado (previne IDOR)
    var _pastaEspaco   = _getPastaAnexos(espacoId);
    var _pastaEspacoId = _pastaEspaco.getId();
    var _fileCheck     = DriveApp.getFileById(fileId);
    var _pais          = _fileCheck.getParents();
    var _pertence      = false;
    while (_pais.hasNext()) {
      if (_pais.next().getId() === _pastaEspacoId) { _pertence = true; break; }
    }
    if (!_pertence) return { ok: false, msg: 'Arquivo não encontrado ou sem permissão' };

    var file  = DriveApp.getFileById(fileId);
    var bytes = file.getBlob().getBytes();
    return {
      ok:   true,
      data: Utilities.base64Encode(bytes),
      mime: file.getMimeType(),
      nome: file.getName()
    };
  } catch (e) {
    return { ok: false, msg: 'Arquivo nao encontrado ou sem permissao' };
  }
}

// =====================================================================
//  UTILITARIOS INTERNOS
// =====================================================================
function _buscarUsuarioPorId(userId) {
  try {
    var ss = _getPlanilha(PLAN_USUARIOS);
    if (!ss) return null;
    var rows = _readAll(ss).rows;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(userId)) return rows[i];
    }
    return null;
  } catch (e) { return null; }
}

function excluirCategoria(id, espacoId, userId) {
  try {
    _assertMembro(userId, espacoId); // C2 — autorização de escrita
    var ss = _getPlanilha(PLAN_CATEGORIAS);
    if (!ss) return { ok: false, msg: 'Planilha não encontrada' };
    var sheet   = _sheet(ss);
    var h       = HEADERS.categorias;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, msg: 'Vazio' };
    var dados   = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxId   = h.indexOf('id');
    var idxEsp  = h.indexOf('espaco_id');
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxId]) === String(id)
          && String(dados[r][idxEsp]) === String(espacoId)) {
        sheet.deleteRow(r + 1);
        SpreadsheetApp.flush();
        return { ok: true };
      }
    }
    return { ok: false, msg: 'Categoria não encontrada' };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

function excluirCarteira(id, espacoId, userId) {
  try {
    _assertMembro(userId, espacoId); // C2 — autorização de escrita
    var ss = _getPlanilha(PLAN_CARTEIRAS);
    if (!ss) return { ok: false, msg: 'Planilha não encontrada' };
    var sheet   = _sheet(ss);
    var h       = HEADERS.carteiras;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { ok: false, msg: 'Vazio' };
    var dados   = sheet.getRange(1, 1, lastRow, h.length).getValues();
    var idxId   = h.indexOf('id');
    var idxEsp  = h.indexOf('espaco_id');
    for (var r = 1; r < dados.length; r++) {
      if (String(dados[r][idxId]) === String(id)
          && String(dados[r][idxEsp]) === String(espacoId)) {
        sheet.deleteRow(r + 1);
        SpreadsheetApp.flush();
        return { ok: true };
      }
    }
    return { ok: false, msg: 'Carteira não encontrada' };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  RELATORIO MENSAL
//  Retorna dados estruturados para os graficos do frontend
// =====================================================================
function relatorioMensal(mes, ano, espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var resultado = listarLancamentosMes(mes, ano, espacoId, userId); // C1 — repassa userId
    if (!resultado.ok) return { ok: false, msg: resultado.msg };

    var rows = resultado.rows || [];
    var cats = listarCategorias(espacoId, userId).rows || []; // C1 — repassa userId

    // ---- Totais por categoria (despesas) ----
    var porCategoriaPagar = {};
    rows.forEach(function(l) {
      if (l.tipo !== 'pagar') return;
      var cid = l.categoria_id || 'sem_categoria';
      porCategoriaPagar[cid] = (porCategoriaPagar[cid] || 0) + (Number(l.valor) || 0);
    });
    var catLabels = [], catValores = [], catCores = [];
    Object.keys(porCategoriaPagar).forEach(function(cid) {
      var cat = cats.find(function(c) { return c.id === cid; });
      catLabels.push(cat ? cat.nome : 'Sem categoria');
      catValores.push(Math.round(porCategoriaPagar[cid] * 100) / 100);
      catCores.push(cat ? cat.cor : '#6b7280');
    });

    // ---- Totais por categoria (receitas) ----
    var porCategoriaReceber = {};
    rows.forEach(function(l) {
      if (l.tipo !== 'receber') return;
      var cid = l.categoria_id || 'sem_categoria';
      porCategoriaReceber[cid] = (porCategoriaReceber[cid] || 0) + (Number(l.valor) || 0);
    });
    var recLabels = [], recValores = [], recCores = [];
    Object.keys(porCategoriaReceber).forEach(function(cid) {
      var cat = cats.find(function(c) { return c.id === cid; });
      recLabels.push(cat ? cat.nome : 'Sem categoria');
      recValores.push(Math.round(porCategoriaReceber[cid] * 100) / 100);
      recCores.push(cat ? cat.cor : '#16a34a');
    });

    // ---- Entradas vs Saídas (pago/recebido) ----
    var r = resultado.resumo;
    var entradasSaidas = {
      labels: ['Recebido', 'Pago', 'A receber', 'A pagar'],
      valores: [r.recebido || 0, r.pago || 0, r.a_receber || 0, r.a_pagar || 0],
      cores: ['#16a34a', '#dc2626', '#3b82f6', '#f97316']
    };

    // ---- Saldo acumulado dia a dia ----
    var diasNoMes = new Date(ano, mes, 0).getDate();
    var saldoDiario = [];
    var acumulado = 0;
    for (var d = 1; d <= diasNoMes; d++) {
      rows.forEach(function(l) {
        var dp = l.data_pagamento ? new Date(l.data_pagamento) : null;
        if (!dp) return;
        if (dp.getMonth() + 1 === mes && dp.getFullYear() === ano && dp.getDate() === d) {
          var v = Number(l.valor) || 0;
          acumulado += (l.tipo === 'receber' ? v : -v);
        }
      });
      saldoDiario.push({ dia: d, saldo: Math.round(acumulado * 100) / 100 });
    }

    // ---- Comparativo últimos 6 meses ----
    var historico = [];
    for (var m = 5; m >= 0; m--) {
      var dm = new Date(ano, mes - 1 - m, 1);
      var rm = listarLancamentosMes(dm.getMonth() + 1, dm.getFullYear(), espacoId, userId); // C1 — repassa userId
      var rs = rm.ok ? rm.resumo : { pago: 0, recebido: 0 };
      historico.push({
        label: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][dm.getMonth()],
        pago: rs.pago || 0,
        recebido: rs.recebido || 0
      });
    }

    return {
      ok: true,
      mes: mes, ano: ano,
      resumo: r,
      porCategoria:        { labels: catLabels, valores: catValores, cores: catCores },
      recebidoCategoria:   { labels: recLabels, valores: recValores, cores: recCores },
      entradasSaidas:      entradasSaidas,
      saldoDiario:         saldoDiario,
      historico:           historico
    };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  GATILHO 1: ALERTA DE VENCIMENTOS
//  Configurar: Gatilhos > relatorioAlertaVencimentos > Diário (06:00-07:00)
// =====================================================================
function alertaVencimentos() {
  try {
    var ssEsp = _getPlanilha(PLAN_ESPACOS);
    if (!ssEsp) return;
    var espacos = _readAll(ssEsp).rows;
    var hoje    = new Date(); hoje.setHours(0, 0, 0, 0);
    var limite  = new Date(hoje); limite.setDate(limite.getDate() + 3);
    var mes = hoje.getMonth() + 1, ano = hoje.getFullYear();

    espacos.forEach(function(esp) {
      var res = listarLancamentosMes(mes, ano, esp.id);
      if (!res.ok) return;

      // Agrupa por membro do espaço
      var ssMem = _getPlanilha(PLAN_MEMBROS);
      if (!ssMem) return;
      var membros = _readAll(ssMem).rows.filter(function(m) {
        return String(m.espaco_id) === String(esp.id);
      });

      var vencendo = res.rows.filter(function(l) {
        if (l.status === 'pago') return false;
        var v = l.data_vencimento ? new Date(l.data_vencimento) : null;
        if (!v) return false;
        v.setHours(0, 0, 0, 0);
        return v >= hoje && v <= limite;
      });
      var atrasados = res.rows.filter(function(l) {
        if (l.status === 'pago') return false;
        var v = l.data_vencimento ? new Date(l.data_vencimento) : null;
        if (!v) return false;
        v.setHours(0, 0, 0, 0);
        return v < hoje;
      });

      if (!vencendo.length && !atrasados.length) return;

      membros.forEach(function(mem) {
        var usuario = _buscarUsuarioPorId(mem.usuario_id);
        if (!usuario || !usuario.email) return;

        var linhasVenc = vencendo.map(function(l) {
          var vd = new Date(l.data_vencimento);
          return '<tr><td style="padding:6px 12px;">' + esc(l.descricao) + '</td>'
            + '<td style="padding:6px 12px;">' + _fmtData(vd) + '</td>'
            + '<td style="padding:6px 12px;text-align:right;">R$ ' + Number(l.valor).toFixed(2) + '</td></tr>';
        }).join('');

        var linhasAtras = atrasados.map(function(l) {
          var vd = new Date(l.data_vencimento);
          return '<tr style="background:#fff1f2;"><td style="padding:6px 12px;">' + esc(l.descricao) + '</td>'
            + '<td style="padding:6px 12px;color:#b91c1c;">' + _fmtData(vd) + '</td>'
            + '<td style="padding:6px 12px;text-align:right;color:#b91c1c;">R$ ' + Number(l.valor).toFixed(2) + '</td></tr>';
        }).join('');

        var html = '<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">'
          + '<h2 style="color:#1e40af;">💰 AZ² Finance — ' + esp.nome + '</h2>';

        if (atrasados.length) {
          html += '<h3 style="color:#b91c1c;margin-top:20px;">⚠️ Pagamentos atrasados (' + atrasados.length + ')</h3>'
            + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
            + '<tr style="background:#f1f5f9;"><th style="padding:6px 12px;text-align:left;">Descrição</th><th style="padding:6px 12px;text-align:left;">Vencimento</th><th style="padding:6px 12px;text-align:right;">Valor</th></tr>'
            + linhasAtras + '</table>';
        }
        if (vencendo.length) {
          html += '<h3 style="color:#d97706;margin-top:20px;">📅 Vencem nos próximos 3 dias (' + vencendo.length + ')</h3>'
            + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
            + '<tr style="background:#f1f5f9;"><th style="padding:6px 12px;text-align:left;">Descrição</th><th style="padding:6px 12px;text-align:left;">Vencimento</th><th style="padding:6px 12px;text-align:right;">Valor</th></tr>'
            + linhasVenc + '</table>';
        }
        html += '<p style="color:#6b7280;font-size:12px;margin-top:24px;">Acesse o AZ² Finance para marcar como pago.</p></div>';

        MailApp.sendEmail({
          to: usuario.email,
          subject: '💰 AZ² Finance — Vencimentos: ' + esp.nome,
          htmlBody: html
        });
      });
    });
  } catch (e) {
    Logger.log('alertaVencimentos erro: ' + e);
  }
}

// =====================================================================
//  GATILHO 2: GERAR LANÇAMENTOS RECORRENTES
//  Configurar: Gatilhos > gerarRecorrencias > Mensal (dia 1)
//  OU: Gatilhos > gerarRecorrencias > Diário e deixar a função checar o dia
// =====================================================================
function gerarRecorrencias() {
  try {
    var hoje = new Date();
    // Só executa no dia 1 de cada mês
    if (hoje.getDate() !== 1) return 'Nao e dia 1, pulando.';

    var mes = hoje.getMonth() + 1;
    var ano = hoje.getFullYear();

    var ssEsp = _getPlanilha(PLAN_ESPACOS);
    if (!ssEsp) return 'Sem espacos';
    var espacos = _readAll(ssEsp).rows;

    var gerados = 0;
    espacos.forEach(function(esp) {
      // Busca lançamentos do mês anterior com recorrência ativa
      var mesAnt = mes - 1 === 0 ? 12 : mes - 1;
      var anoAnt = mes - 1 === 0 ? ano - 1 : ano;
      var resAnt = listarLancamentosMes(mesAnt, anoAnt, esp.id);
      if (!resAnt.ok) return;

      // Filtra recorrentes mensais (deduplica por grupo: pega só parcela_total=1 ou ausente)
      var recorrentes = resAnt.rows.filter(function(l) {
        return l.recorrencia === 'mensal' && (!l.grupo_id || String(l.grupo_id).length < 2);
      });

      // Verifica se já existe no mês atual (evita duplicatas)
      var resMes = listarLancamentosMes(mes, ano, esp.id);
      var existentes = resMes.ok ? resMes.rows.map(function(l) { return l.descricao + '|' + l.valor + '|' + l.tipo; }) : [];

      recorrentes.forEach(function(l) {
        var chave = l.descricao + '|' + l.valor + '|' + l.tipo;
        if (existentes.indexOf(chave) >= 0) return; // já existe

        // Calcula novo vencimento (mesmo dia do mês, mês atual)
        var diaVenc = l.data_vencimento ? new Date(l.data_vencimento).getDate() : 1;
        var novaData = new Date(ano, mes - 1, diaVenc);

        var novoLanc = {
          tipo:           l.tipo,
          descricao:      l.descricao,
          valor:          l.valor,
          categoria_id:   l.categoria_id,
          carteira_id:    l.carteira_id,
          data_vencimento: novaData.toISOString(),
          parcela_total:  1,
          recorrencia:    'mensal',
          espaco_id:      esp.id,
          criado_por:     l.criado_por,
          anexo:          null
        };
        salvarLancamento(novoLanc);
        gerados++;
      });
    });

    Logger.log('gerarRecorrencias: ' + gerados + ' lancamentos criados para ' + mes + '/' + ano);
    return 'OK: ' + gerados + ' lançamentos criados';
  } catch (e) {
    Logger.log('gerarRecorrencias erro: ' + e);
    return 'ERRO: ' + String(e);
  }
}

// =====================================================================
//  GERAR PDF DO FECHAMENTO MENSAL
//  Salva na pasta do espaço e retorna URL pública de visualização
// =====================================================================
function gerarRelatorioPDF(mes, ano, espacoId, userId) {
  try {
    if (userId) _assertMembro(userId, espacoId); // C1 — autorização de leitura
    var relat = relatorioMensal(mes, ano, espacoId, userId); // C1 — repassa userId
    if (!relat.ok) return { ok: false, msg: relat.msg };

    var cats  = listarCategorias(espacoId, userId).rows || []; // C1 — repassa userId
    var r     = relat.resumo;
    var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    var nomeEsp = _getNomeEspaco(espacoId);

    // Linhas por categoria
    var linhasCat = relat.porCategoria.labels.map(function(nome, i) {
      return '<tr><td style="padding:5px 10px;">' + nome + '</td>'
        + '<td style="padding:5px 10px;text-align:right;color:#b91c1c;">R$ '
        + Number(relat.porCategoria.valores[i]).toFixed(2) + '</td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<style>body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:32px}'
      + 'h1{color:#1e40af;font-size:20px}h2{font-size:14px;color:#334155;margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}'
      + 'table{width:100%;border-collapse:collapse;margin-top:8px}'
      + 'th{background:#f1f5f9;padding:6px 10px;text-align:left;font-size:12px}'
      + 'td{padding:5px 10px;border-bottom:1px solid #f1f5f9}'
      + '.resumo-grid{display:flex;gap:16px;margin:16px 0}'
      + '.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;flex:1}'
      + '.kpi-label{font-size:11px;color:#64748b}.kpi-val{font-size:18px;font-weight:700}'
      + '.ok{color:#15803d}.err{color:#b91c1c}.warn{color:#b45309}'
      + '</style></head><body>'
      + '<h1>💰 AZ² Finance — Fechamento Mensal</h1>'
      + '<p style="color:#64748b;">' + nomeEsp + ' · ' + MESES[mes - 1] + ' ' + ano + '</p>'
      + '<div class="resumo-grid">'
      + '<div class="kpi"><div class="kpi-label">Saldo do mês</div><div class="kpi-val ' + (r.saldo >= 0 ? 'ok' : 'err') + '">R$ ' + Number(r.saldo || 0).toFixed(2) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">Total recebido</div><div class="kpi-val ok">R$ ' + Number(r.recebido || 0).toFixed(2) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">Total pago</div><div class="kpi-val err">R$ ' + Number(r.pago || 0).toFixed(2) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">A receber</div><div class="kpi-val warn">R$ ' + Number(r.a_receber || 0).toFixed(2) + '</div></div>'
      + '<div class="kpi"><div class="kpi-label">A pagar</div><div class="kpi-val warn">R$ ' + Number(r.a_pagar || 0).toFixed(2) + '</div></div>'
      + '</div>'
      + '<h2>Despesas por categoria</h2>'
      + '<table><tr><th>Categoria</th><th style="text-align:right;">Total</th></tr>'
      + linhasCat + '</table>'
      + '<p style="margin-top:32px;font-size:11px;color:#94a3b8;">Gerado em ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + '</p>'
      + '</body></html>';

    var blob     = Utilities.newBlob(html, 'text/html', 'relatorio.html');
    var tempFile = DriveApp.createFile(blob);
    var pdfBlob  = tempFile.getAs('application/pdf');
    tempFile.setTrashed(true);

    var nomeArq = 'Relatorio_' + MESES[mes - 1] + '_' + ano + '_' + nomeEsp.replace(/\s/g, '_') + '.pdf';
    pdfBlob.setName(nomeArq);

    var pasta   = _getPastaAnexos(espacoId);
    var pdfFile = pasta.createFile(pdfBlob);
    // VULN 4 corrigida: PDF mantido privado, acesso via getAnexo() autenticado
    // O ID é retornado; o frontend chama getAnexo() para obter o conteúdo

    return {
      ok:   true,
      fileId: pdfFile.getId(),
      nome: nomeArq
    };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}

// =====================================================================
//  INSTRUCOES PARA CONFIGURAR OS GATILHOS AUTOMATICOS
//  Execute configurarGatilhos() UMA VEZ no editor para criar os gatilhos
// =====================================================================
function configurarGatilhos() {
  _assertDono();
  // Remove gatilhos antigos com o mesmo nome para evitar duplicatas
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'alertaVencimentos'
        || t.getHandlerFunction() === 'gerarRecorrencias') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Alerta diário às 7h
  ScriptApp.newTrigger('alertaVencimentos')
    .timeBased().everyDays(1).atHour(7).create();

  // Recorrências diário (a função verifica se é dia 1 internamente)
  ScriptApp.newTrigger('gerarRecorrencias')
    .timeBased().everyDays(1).atHour(6).create();

  Logger.log('Gatilhos configurados com sucesso!');
  return 'OK: gatilhos de alerta (7h) e recorrência (6h) criados.';
}

// =====================================================================
//  UTILITARIOS INTERNOS EXTRAS
// =====================================================================
function _fmtData(d) {
  var dia = d.getDate(), mes = d.getMonth() + 1, ano = d.getFullYear();
  return (dia < 10 ? '0' : '') + dia + '/' + (mes < 10 ? '0' : '') + mes + '/' + ano;
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// =====================================================================
//  MIGRACAO: corrige icones Tabler para emoji nas categorias existentes
//  Execute UMA VEZ no editor se ja tinha dados cadastrados antes desta versao
// =====================================================================
function migrarIconesCategorias() {
  _assertDono();
  var MAP = {
    'utensils':               '🍽️',
    'home':                   '🏠',
    'car':                    '🚗',
    'heart-pulse':            '❤️',
    'school':                 '📚',
    'device-gamepad-2':       '🎮',
    'shirt':                  '👕',
    'repeat':                 '🔄',
    'dots-circle-horizontal': '📦',
    'cash':                   '💵',
    'briefcase':              '💼',
    'trending-up':            '📈'
  };

  var ss = _getPlanilha(PLAN_CATEGORIAS);
  if (!ss) { Logger.log('Planilha categorias nao encontrada'); return; }
  var sheet  = _sheet(ss);
  var h      = HEADERS.categorias;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Sem categorias para migrar'); return; }

  var dados  = sheet.getRange(1, 1, lastRow, h.length).getValues();
  var idxIco = h.indexOf('icone');
  var alterados = 0;

  for (var r = 1; r < dados.length; r++) {
    var iconeAtual = String(dados[r][idxIco] || '').trim();
    if (MAP[iconeAtual]) {
      sheet.getRange(r + 1, idxIco + 1).setValue(MAP[iconeAtual]);
      alterados++;
    }
  }
  SpreadsheetApp.flush();
  Logger.log('migrarIconesCategorias: ' + alterados + ' icones corrigidos.');
  return 'OK: ' + alterados + ' ícones corrigidos.';
}

// =====================================================================
//  DIAGNOSTICO - rodar pelo editor para checar estado
//  Item 4 — protegido por _assertDono, impede varredura remota
// =====================================================================
function diagnosticarTudo() {
  _assertDono();
  _cache = {};
  var nomes = [PLAN_USUARIOS, PLAN_CONVITES, PLAN_ESPACOS, PLAN_MEMBROS, PLAN_CATEGORIAS, PLAN_CARTEIRAS];
  var saida = [];
  for (var n = 0; n < nomes.length; n++) {
    var nome = nomes[n];
    var ss   = _getPlanilha(nome);
    if (!ss) { saida.push(nome + ': NAO ENCONTRADA'); continue; }
    var sheet   = _sheet(ss);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var header  = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    saida.push(nome + ': ' + (lastRow - 1) + ' registros | [' + header.join(', ') + ']');
    Logger.log(saida[saida.length - 1]);
  }
  return saida.join(' || ');
}
