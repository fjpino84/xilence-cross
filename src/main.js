// Punto de entrada: crea el juego, registra las escenas y arranca en el título.
const game = new Game(document.getElementById('game-canvas'), document.getElementById('modal-root'));

game.scenes.register('title', new TitleScene(game));
game.scenes.register('game', new GameScene(game));
game.scenes.register('gameover', new GameOverScene(game));
game.scenes.register('ending', new EndingScene(game));

// Precarga de imágenes; si alguna falta, el juego usa sus gráficos de respaldo
Assets.loadImages(CONFIG.ASSETS).then(() => {
  game.scenes.change('title');
  game.start();
});
