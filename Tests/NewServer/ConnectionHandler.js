/*
    When a new player connects, ConnectionHandler takes note and does setup
    Player disconnect and auto-reconnect and done here
*/

const Client = require("./Client.js");
const Logger = require("./Logger.js");
const AccountHandler = require("./AccountHandler.js");
const RulesHandler = require("./RulesHandler.js");
const DefaultRules = require("./DefaultRules.js");

const SocketTools = {
  verifySocketId: (socketId) => {
    return !(
      socketId === undefined ||
      isNaN(socketId) ||
      socketId == 0 ||
      socketId == null
    );
  },
  verifyRulesReq: (type, data) => {
    if (typeof type !== "string" || typeof data === "function") {
      return false;
    }
    if (type !== "get" && type !== "set" && type !== "template") {
      return false;
    }
    return true;
  },
};

const ConnectionHandler = {
  clients: [],
  callbacks: {},
  exists: (socketId) => {
    return !!ConnectionHandler.clients[socketId];
  },
  addClient: (socketId, args) => {
    ConnectionHandler.clients[socketId] = new Client(args);
  },
  loadData: (args) => {
    ConnectionHandler.clients[args.socketId].userInfo = args.info;
  },
  signInSuccess: (args) => {
    ConnectionHandler.clients[args.socketId].username = args.username;
    ConnectionHandler.clients[args.socketId].token = args.token;
  },
  sendTemplate: (args) => {
    SOCKET_LIST[args.socketId].emit("template", args.template);
  },
  sendTemplateList: (args) => {
    SOCKET_LIST[args.socketId].emit("templateList", DefaultRules.templateList);
  },
};

const { Server } = require("socket.io");
// const io = new Server(3000);
const io = new Server(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const SOCKET_LIST = [];

io.on("connection", (socket) => {
  let socketId = socket.handshake.auth.token;
  if (!SocketTools.verifySocketId(socketId)) {
    socket.disconnect(); //Illegal socket
    return;
  }
  if (!ConnectionHandler.exists(socketId)) {
    //New client
    ConnectionHandler.addClient(socketId, { id: socketId });
    SOCKET_LIST[socketId] = socket;

    AccountHandler.signIn({
      username: socket.handshake.auth.username,
      token: socket.handshake.auth.signInToken,
      id: socketId,
    });

    //!! REMOVE IN PRODUCTION. FOR TESTING PURPOSES ONLY !!
    Logger.error('AUTO SIGN-IN! REMOVE IN PRODUCTION!');
    ConnectionHandler.signInSuccess({ username: 'Test', token: 'tOkEn', socketId: socketId });
    Logger.log('Client name: ' + ConnectionHandler.clients[socketId].username);


    Logger.event("join", { socketId: socketId });
  }

  socket.on("rules", (type, data) => {
    if (!SocketTools.verifyRulesReq(type, data)) {
      return;
    }
    RulesHandler.userRequest({
      rules: ConnectionHandler.clients[socketId].rules,
      type: type,
      data: data,
      socketId: socketId,
    });
  });

  socket.on("getTemplates", (callback) => {
    callback(DefaultRules.templateList);
  });

  socket.on("getCustomTemplates", (callback) => {
    callback(RulesHandler.getUserTemplates(ConnectionHandler.clients[socketId].username));
  });

  socket.on("useTemplate", (template, callback) => {
    Logger.log("use template " + socketId);
    RulesHandler.useTemplate(
      ConnectionHandler.clients[socketId].rules,
      template
    );
    Logger.log(JSON.stringify(ConnectionHandler.clients[socketId].rules));
    callback(
      ConnectionHandler.clients[socketId].rules.phasesList,
      ConnectionHandler.clients[socketId].rules.stepsList,
      ConnectionHandler.clients[socketId].rules.basic
    );
  });

  socket.on("useCustomTemplate", (template, callback) => {
    Logger.log("use custom template " + socketId);
    RulesHandler.useCustomTemplate(
        ConnectionHandler.clients[socketId].rules,
        ConnectionHandler.clients[socketId].username,
        template
    );
    Logger.log(JSON.stringify(ConnectionHandler.clients[socketId].rules));
    callback(
      ConnectionHandler.clients[socketId].rules.phasesList,
      ConnectionHandler.clients[socketId].rules.stepsList,
      ConnectionHandler.clients[socketId].rules.basic
    );
  })

  socket.on('saveTemplate', (templateName, callback) => {
    Logger.log('save template ' + socketId);
    callback(RulesHandler.saveTemplate(ConnectionHandler.clients[socketId].rules, ConnectionHandler.clients[socketId].username, templateName));
  });

    socket.on('setPhases', (newPhases, callback) => {
        Logger.log('set phases ' + socketId);
        ConnectionHandler.clients[socketId].rules.phases = newPhases;
        callback(ConnectionHandler.clients[socketId].rules.phasesList, ConnectionHandler.clients[socketId].rules.stepsList);
    });


    socket.on('getSteps', (callback) => {
        Logger.log('get steps ' + socketId)
        callback(ConnectionHandler.clients[socketId].rules.stepsList);
    });

    socket.on('setSteps', (newSteps, callback) => {
        Logger.log('set steps ' + socketId);
        ConnectionHandler.clients[socketId].rules.steps = newSteps;
        callback(ConnectionHandler.clients[socketId].rules.stepsList);
    });

    socket.on('setStepsAndPhases', (newSteps, newPhases, callback) => {
        Logger.log('set steps and phases ' + socketId);
        ConnectionHandler.clients[socketId].rules.steps = newSteps;
        callback(ConnectionHandler.clients[socketId].rules.stepsList, ConnectionHandler.clients[socketId].rules.phasesList);
    });

  socket.on("getPhases", (callback) => {
    Logger.log("get phases " + socketId);
    callback(
      ConnectionHandler.clients[socketId].rules.phasesList,
      ConnectionHandler.clients[socketId].rules.stepsList
    );
  });

  socket.on("getSteps", (callback) => {
    Logger.log("get steps " + socketId);
    callback(ConnectionHandler.clients[socketId].rules.stepsList);
  });

  socket.on("getBasicRules", (callback) => {
    Logger.log("get basic " + socketId);
    callback(ConnectionHandler.clients[socketId].rules.basic);
  });

  socket.on("setBasicRules", (basic, callback) => {
    Logger.log("set basic " + socketId);
    ConnectionHandler.clients[socketId].rules.basic = basic;
    callback(ConnectionHandler.clients[socketId].rules.basic);
  });

  socket.on("getPhaseInstructions", (phase, callback) => {
    Logger.log("get phase instructions " + socketId);
    callback(ConnectionHandler.clients[socketId].rules.phases[phase]);
  });

  socket.on("setPhaseInstructions", (phase, instr, callback) => {
    Logger.log("set phase instructions " + socketId);
    ConnectionHandler.clients[socketId].rules.setInstructions(phase, instr);
    callback(ConnectionHandler.clients[socketId].rules.phases[phase]);
  })

  socket.on("setStepInstructions", (phase, step, instructions, callback) => {
    Logger.log("set step instructions " + socketId);
    ConnectionHandler.clients[socketId].rules.setStepInstructions(phase, step, instructions);
    callback(ConnectionHandler.clients[socketId].rules.phases[phase]);
  })
});

module.exports = ConnectionHandler;
