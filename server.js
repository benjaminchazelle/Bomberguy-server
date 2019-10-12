/* eslint-disable no-console */

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    path: '/socket',
});

app.use(express.static(__dirname + '/dist'));

app.get('/restart', function () {
    process.exit();
})

// var seed = 1;
function random() {
    return Math.random();
    // var x = Math.sin(seed++) * 10000;
    // return x - Math.floor(x);
}

class Bomb {

    constructor(player, cell) {
        this.player = player;
        this.cell = cell;

        this.countdown = 9;
    }

    tictac() {
        this.countdown--;

        if (this.countdown < 0) {
            this.player.bombStock++;
            this.cell.bomb = null;

            this.cell.fire = 4;
            this.cell.fireDirection.up = true;
            this.cell.fireDirection.down = true;
            this.cell.fireDirection.left = true;
            this.cell.fireDirection.right = true;
        }
    }


}

class Cell {

    constructor(x, y, cells) {
        this.x = x;
        this.y = y;
        this.cells = cells;
        this.properties = null;
        this.player = null;
        this.bomb = null;

        this.fire = 0;
        this.fireDirection = {
            up: false,
            down: false,
            left: false,
            right: false
        };
    }

    setAs(newProperties) {
        if (typeof(newProperties) !== 'function') {
            return console.error('SET AS: NOT AN ELEMENT FUNCTION')
        }

        if (this.properties === null || this.properties().symbol !== newProperties().symbol) {
            this.properties = newProperties;
        }
    }

    is(givenProperties) {
        if (typeof(givenProperties) !== 'function') {
            throw new Error("IS: NOT AN ELEMENT FUNCTION");
        }

        return this.properties !== null && this.getSymbol() === givenProperties().symbol;
    }

    getSymbol() {
        if (this.properties === null) {
            throw Error("GET SYMBOL : NOT INIT")
        }

        return this.properties().symbol;
    }

    isTraversable() {
        if (this.properties === null) {
            return console.error("IS TRAVERSABLE : NOT INIT")
        }

        return this.properties().isTraversable;
    }

    isDestroyable() {
        if (this.properties === null) {
            return console.error("IS DESTROYABLE : NOT INIT")
        }

        return this.properties().isDestroyable;
    }

    getNeighbours() {
        let neighbours = [
            this.cells.getCellUnsafe(this.x - 1, this.y - 1),
            this.cells.getCellUnsafe(this.x, this.y - 1),
            this.cells.getCellUnsafe(this.x + 1, this.y - 1),
            this.cells.getCellUnsafe(this.x - 1, this.y),
            this.cells.getCellUnsafe(this.x + 1, this.y),
            this.cells.getCellUnsafe(this.x - 1, this.y + 1),
            this.cells.getCellUnsafe(this.x, this.y + 1),
            this.cells.getCellUnsafe(this.x + 1, this.y + 1)
        ];

        neighbours = neighbours.filter((cell) => cell !== null);

        return neighbours;
    }

    static isPopable(cell) {
        return cell !== null && cell.isTraversable() && cell.bomb == null && cell.player === null && cell.fire === 0
    }

    getUpCell() {
        return this.cells.getCellUnsafe(this.x, this.y - 1);
    }

    getDownCell() {
        return this.cells.getCellUnsafe(this.x, this.y + 1);
    }

    getLeftCell() {
        return this.cells.getCellUnsafe(this.x - 1, this.y);
    }

    getRightCell() {
        return this.cells.getCellUnsafe(this.x + 1, this.y);
    }

    isSpawnable() {

        if (!Cell.isPopable(this)) {
            return false;
        }

        let upCellPopable = Cell.isPopable(this.getUpCell());
        let leftCellPopable = Cell.isPopable(this.getLeftCell());
        let downCellPopable = Cell.isPopable(this.getDownCell());
        let rightCellPopable = Cell.isPopable(this.getRightCell());

        let upLeftCellPopable = Cell.isPopable(this.cells.getCellUnsafe(this.x - 1, this.y - 1));
        let upRightCellPopable = Cell.isPopable(this.cells.getCellUnsafe(this.x + 1, this.y - 1));
        let downLeftCellPopable = Cell.isPopable(this.cells.getCellUnsafe(this.x - 1, this.y + 1));
        let downRightCellPopable = Cell.isPopable(this.cells.getCellUnsafe(this.x + 1, this.y + 1));

        if (upLeftCellPopable && (upCellPopable || leftCellPopable)) {
            return true;
        }
        else if (upRightCellPopable && (upCellPopable || rightCellPopable)) {
            return true;
        }
        else if (downLeftCellPopable && (downCellPopable || leftCellPopable)) {
            return true;
        }
        else if (downRightCellPopable && (downCellPopable || rightCellPopable)) {
            return true;
        }

        return false;
    }

    dropBomb(player) {
        if (this.bomb === null && player.bombStock > 0) {
            this.bomb = new Bomb(player, this);
            player.bombStock--;
        }

    }

    static Path() {
        return {
            symbol: ' ',
            isTraversable: true,
            isDestroyable: false
        }
    }

    static Wall() {
        return {
            symbol: 'W',
            isTraversable: false,
            isDestroyable: false
        }
    }

    static Spawn() {
        return {
            symbol: '.',
            isTraversable: true,
            isDestroyable: false
        }
    }

    static Brick() {
        return {
            symbol: '#',
            isTraversable: false,
            isDestroyable: true
        }
    }

    static Rock() {
        return {
            symbol: 'R',
            isTraversable: false,
            isDestroyable: false
        }
    }

}


class Cells {

    constructor(game, width = 23, height = 23) {

        this.game = game;

        this.width = width;
        this.height = height;

        this.cells = Array(width * height);

        this.playersCell = {};

        for (let k = 0; k < this.cells.length; k++) {
            this.initCell(k);
            this.getCell(k).setAs(Cell.Path);
        }

        for (let i = 0; i < this.width; i++) {
            this.getCell(i, 0).setAs(Cell.Wall);
            this.getCell(i, this.height - 1).setAs(Cell.Wall);
        }

        for (let j = 0; j < this.height; j++) {
            this.getCell(0, j).setAs(Cell.Wall);
            this.getCell(this.width - 1, j).setAs(Cell.Wall);
        }

        for (let j = 2; j < this.height - 1; j += 2) {
            for (let i = 2; i < this.width - 1; i += 2) {
                this.getCell(i, j).setAs(Cell.Rock);
            }
        }

        for (let numberOfSpawn = 0; numberOfSpawn < 4;) {
            let cell = this.getRandomCell();
            if (cell.is(Cell.Path)) {
                cell.setAs(Cell.Spawn);

                for (let neighbourCell of cell.getNeighbours()) {
                    if (neighbourCell.is(Cell.Path)) {
                        neighbourCell.setAs(Cell.Spawn);
                    }
                }

                numberOfSpawn++;
            }
        }

        for (let k = 0; k < this.cells.length; k++) {
            let cell = this.getRandomCell();
            if (cell.is(Cell.Path)) {
                cell.setAs(Cell.Brick)
            }
        }

        for (let k = 0; k < this.cells.length; k++) {
            let cell = this.getCell(k);
            if (cell.is(Cell.Spawn)) {
                cell.setAs(Cell.Path)
            }
        }
    }

    getCellOfPlayer(player) {
        if (player.socket.id in this.playersCell) {
            return this.playersCell[player.socket.id];
        } else {
            return null;
        }
    }

    getRandomCell() {
        let k = Math.floor(random() * (this.cells.length));
        return this.getCell(k);
    }

    getCellUnsafe(x, y = null) {
        let k = (y == null) ? x : (y * this.width + x);
        if (k < 0 || this.cells.length <= k) {
            return null;
        }
        return this.cells[k];
    }

    getCell(x, y = null) {
        let cell = this.getCellUnsafe(x, y);

        if (cell === null) {
            return console.error("GET CELL ERROR")
        }

        return cell;
    }

    initCell(k) {
        let x = k % this.width;
        let y = (k - x) / this.width;
        this.cells[k] = new Cell(x, y, this);
    }

    unsetPlayer(player) {
        let oldCell = (player.socket.id in this.playersCell) ? this.playersCell[player.socket.id] : null;

        if (oldCell !== null) {
            oldCell.player = null;
        }
    }

    setPlayer(player, newCell) {

        if (this.cells.indexOf(newCell) === -1) {
            throw Error("SET PLAYER : NOT AN OWNED CELL")
        }

        let oldCell = (player.socket.id in this.playersCell) ? this.playersCell[player.socket.id] : null;

        if (oldCell !== null) {
            oldCell.player = null;
        }

        newCell.player = player;

        this.playersCell[player.socket.id] = newCell;

    }

    findFreePlayerPosition() {

        let freePathCells = [];

        for (let k = 0; k < this.cells.length; k++) {
            let cell = this.getCell(k);
            if (cell.isSpawnable()) {
                freePathCells.push({
                    cell: cell,
                    averageEnemiesDistance: null
                });
            }
        }

        let totalEnemies = 0;
        for (let freeCellMeta of freePathCells) {
            freeCellMeta.averageEnemiesDistance = 0;
            for (let playerSocketId in this.game.players) {
                if(!this.game.players.hasOwnProperty(playerSocketId)) {
                    return;
                }
                let playerCell = this.getCellOfPlayer(this.game.players[playerSocketId]);
                if (playerCell !== null) {
                    freeCellMeta.averageEnemiesDistance += Math.abs(playerCell.x - freeCellMeta.cell.x);
                    freeCellMeta.averageEnemiesDistance += Math.abs(playerCell.y - freeCellMeta.cell.y);
                    totalEnemies++;
                }
            }
            freeCellMeta.averageEnemiesDistance /= totalEnemies;
        }

        return freePathCells[Math.floor(Math.random() * freePathCells.length)].cell

    }

    draw() {

        let str = "\n";

        for (let j = 0; j < this.height; j++) {
            let line = "";
            for (let i = 0; i < this.width; i++) {
                let cell = this.getCell(i, j);
                if (cell.player !== null) {
                    line += "$"
                }
                else if (cell.fire > 0) {
                    line += cell.fire
                }
                else if (cell.bomb !== null) {
                    line += cell.bomb.countdown
                } else {
                    line += cell.getSymbol()
                }
            }
            str += line + "\n";
        }
        console.log(str)

    }

}

let allPlayers = {};

class Player {

    static getPlayerBySocket(socket) {
        allPlayers[socket.id] = (socket.id in allPlayers) ? allPlayers[socket.id] : new Player(socket);
        return allPlayers[socket.id];
    }

    constructor(socket) {

        this.game = null;

        this.socket = socket;

        this.pseudo = null;

        this.resetContext()

    }

    resetContext() {
        this.direction = "down";
        this.isMoving = false;
        this.isStopingMoving = false;
        this.isBombing = false;
        this.isStopingBombing = false;
        this.bombStock = 3;
        this.life = 10;

    }

}


class Game {

    constructor(id, onGameChange, excpetedPlayers = 2) {

        this.id = id;
        this.onGameChange = onGameChange;

        this.players = {};

        this.map = new Cells(this);

        this.excpetedPlayers = excpetedPlayers;

        this.hasStarted = false;

        setInterval(() => this.refresh(), 150);

        this.time = 0;
    }

    broadcast(event, data) {
        for (let [playerSocketId, player] of Object.entries(this.players)) {
            player.socket.emit(event, data);
        }
    }

    removePlayer(player) {

        this.map.getCellOfPlayer(player).player = null;

        if(player.socket.id in this.map.playersCell) {
            delete this.map.playersCell[player.socket.id];
        }

        if(player.socket.id in this.players) {
            delete this.players[player.socket.id];
        }

        player.game = null;

        if(Object.keys(this.players).length === 0) {
            delete games[this.id];
        }

        this.onGameChange();
    }

    addPlayer(player) {

        if (player.game === this) {
            return;
        }

        if (player.game !== null) {
            delete player.game.players[player.socket.id];
            player.game = null;
        }

        this.players[player.socket.id] = player;
        player.game = this;
        player.resetContext();

        this.map.setPlayer(player, this.map.findFreePlayerPosition());

        if (!this.hasStarted && Object.keys(this.players).length === this.excpetedPlayers) {

            setTimeout(() => this.broadcast('countdown', 3), 0);
            setTimeout(() => this.broadcast('countdown', 2), 1000);
            setTimeout(() => this.broadcast('countdown', 1), 2000);
            setTimeout(() => {
                this.broadcast('countdown', 0);
                this.hasStarted = true;
                this.onGameChange();
            }, 3000);


        }

        this.onGameChange();
    }

    listen(player, event) {


        if (!this.hasStarted || !(player.socket.id in this.players) || player.life === 0) {
            return;
        }

        switch (event) {

            case 'moveUp':
                player.direction = "up";
                player.isMoving = true;
                break;

            case 'moveLeft':
                player.direction = "left";
                player.isMoving = true;
                break;

            case 'moveRight':
                player.direction = "right";
                player.isMoving = true;
                break;

            case 'moveDown':
                player.direction = "down";
                player.isMoving = true;
                break;

            case 'stopMoving':
                player.isStopingMoving = true;
                break;

            case 'bomb':
                player.isBombing = true;
                break;

            case 'stopBombing':
                player.isStopingBombing = true;
                break;

        }

    }


    refresh() {

        if(!this.hasStarted) {
            return;
        }

        for (let [playerSocketId, player] of Object.entries(this.players)) {

            if (player.isMoving) {
                let nextCell;
                switch (player.direction) {
                    case "up":
                        nextCell = this.map.getCellOfPlayer(player).getUpCell();
                        break;
                    case "down":
                        nextCell = this.map.getCellOfPlayer(player).getDownCell();
                        break;
                    case "left":
                        nextCell = this.map.getCellOfPlayer(player).getLeftCell();
                        break;
                    case "right":
                        nextCell = this.map.getCellOfPlayer(player).getRightCell();
                        break;
                }

                if (nextCell !== null && nextCell.isTraversable() && nextCell.player === null) {
                    this.map.setPlayer(player, nextCell);
                }
            }

            if (player.isBombing) {
                this.map.getCellOfPlayer(player).dropBomb(player);
            }

            if (player.isStopingMoving) {
                player.isStopingMoving = false;
                player.isMoving = false;
            }

            if (player.isStopingBombing) {
                player.isStopingBombing = false;
                player.isBombing = false;
            }

        }

        for (let cell of this.map.cells) {
            cell.previouslyOnFire = cell.fire > 0;
        }

        for (let cell of this.map.cells) {
            if (cell.bomb !== null) {
                cell.bomb.tictac();
            }

            if (cell.previouslyOnFire) {
                let up = cell.getUpCell();
                if (cell.fireDirection.up && up !== null && (up.isTraversable() || up.isDestroyable())) {
                    up.fire = Math.max(up.fire, cell.fire - 1);
                    if (up.fire > 0) {
                        up.fireDirection.up = true;
                        if (up.isDestroyable()) {
                            up.fireDirection.up = false;
                            up.setAs(Cell.Path)
                        }
                    }
                }

                let down = cell.getDownCell();
                if (cell.fireDirection.down && down !== null && (down.isTraversable() || down.isDestroyable())) {
                    down.fire = Math.max(down.fire, cell.fire - 1);
                    if (down.fire > 0) {
                        down.fireDirection.down = true;
                        if (down.isDestroyable()) {
                            down.fireDirection.down = false;
                            down.setAs(Cell.Path)
                        }
                    }
                }

                let left = cell.getLeftCell();
                if (cell.fireDirection.left && left !== null && (left.isTraversable() || left.isDestroyable())) {
                    left.fire = Math.max(left.fire, cell.fire - 1);
                    if (left.fire > 0) {
                        left.fireDirection.left = true;
                        if (left.isDestroyable()) {
                            left.fireDirection.left = false;
                            left.setAs(Cell.Path)
                        }
                    }
                }

                let right = cell.getRightCell();
                if (cell.fireDirection.right && right !== null && (right.isTraversable() || right.isDestroyable())) {
                    right.fire = Math.max(right.fire, cell.fire - 1);
                    if (right.fire > 0) {
                        right.fireDirection.right = true;
                        if (right.isDestroyable()) {
                            right.fireDirection.right = false;
                            right.setAs(Cell.Path)
                        }
                    }
                }
            }
        }

        for (let cell of this.map.cells) {
            if (cell.previouslyOnFire) {
                cell.fire--;

                cell.fireDirection.up = false;
                cell.fireDirection.down = false;
                cell.fireDirection.left = false;
                cell.fireDirection.right = false;
            }

            cell.previouslyOnFire = false;
        }

        for (let cell of this.map.cells) {
            if (cell.fire > 0 && cell.player !== null) {
                cell.player.life--;
                if (cell.player.life > 0) {
                    this.map.setPlayer(cell.player, this.map.findFreePlayerPosition());
                } else {
                    this.map.unsetPlayer(cell.player);
                }
            }
        }

        this.broadcast('refresh', this.export());

        //console.clear();
        //this.map.draw();

        for (let p in this.players) {
            if(!this.players.hasOwnProperty(p)) {
                return;
            }
        }

        this.time++;
    }

    export() {

        let condensedData = {
            players: {},
            map: {
                width: this.map.width,
                height: this.map.height,
                cells: [],
            }
        };

        for (let playerSocketId in this.players) {
            if(!this.players.hasOwnProperty(playerSocketId)) {
                return;
            }
            let player = this.players[playerSocketId];

            let playerCell = this.map.getCellOfPlayer(player);

            condensedData.players[player.socket.id] = {
                pseudo: player.pseudo,
                index: Object.keys(condensedData.players).length,
                socketId: player.socket.id,
                direction: player.direction,
                bombStock: player.bombStock,
                life: player.life,
                position: playerCell === null ? null : {
                    x: playerCell.x,
                    y: playerCell.y,
                }
            }
        }

        for(let j = 0; j < this.map.height; j++) {
            for(let i = 0; i < this.map.width; i++) {
                let cell = this.map.getCell(i, j);
                if (cell.fire > 0) {
                    condensedData.map.cells.push(["F", cell.fire]);
                }
                else if (cell.bomb !== null) {
                    condensedData.map.cells.push(["B", cell.bomb.countdown]);
                } else {
                    condensedData.map.cells.push(cell.getSymbol());
                }
            }
        }

        return condensedData;
    }
}

let games = {};

function exportGames() {

    let data = {};

    for(let gameId in games) {
        if(!games.hasOwnProperty(gameId)) {
            return;
        }
        data[gameId] = {
            players : [],
            hasStarted: games[gameId].hasStarted
        };

        for(let playerSocketId in games[gameId].players) {
            if(!games[gameId].players.hasOwnProperty(playerSocketId)) {
                return;
            }
            data[gameId].players.push(games[gameId].players[playerSocketId].pseudo);
        }
    }

    return data;

}

let nextGameId = 1;

io.on('connection', function (socket) {
    console.log('A user connected');

    socket.emit('games', exportGames());

    socket.on('getGames', () => socket.emit('games', exportGames()));

    socket.on('quitGame', function () {

        let player = Player.getPlayerBySocket(socket);

        if(player.game !== null) {
            player.game.removePlayer(player);
        }

        delete allPlayers[player.socket.id];

    });

    socket.on('joinGame', function ({gameId, pseudo}) {

        if(gameId === null) {
            gameId = nextGameId++;
        }

        games[gameId] = gameId in games ? games[gameId] : new Game(gameId, () => socket.broadcast.emit('games', exportGames()));

        let player = Player.getPlayerBySocket(socket);
        player.pseudo = pseudo;

        games[gameId].addPlayer(player);

    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');

        let player = Player.getPlayerBySocket(socket);

        if(player.game !== null) {
            player.game.removePlayer(player);
        }

        delete allPlayers[player.socket.id];
    });

    for (let event of ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'bomb', 'stopMoving', 'stopBombing']) {

        socket.on(event, function (data) {
            let player = Player.getPlayerBySocket(socket);
            if (player.game === null) {
                return;
            }
            player.game.listen(player, event, data);
        })
    }

});

const listener = server.listen(process.env.PORT || 9000, function () {
    console.log('Your app is listening on port ' + listener.address().port);
});
