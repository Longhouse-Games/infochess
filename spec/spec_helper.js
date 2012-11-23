define(['lib/helper', 'lib/playing_board', 'lib/building_board'],
    function(HelperModule, PlayingBoardModule, BuildingBoardModule) {

var PlayingBoard = PlayingBoardModule.PlayingBoard;
var BuildingBoard = BuildingBoardModule.BuildingBoard;
var Position = HelperModule.Position;
var Piece = HelperModule.Piece;

var makeBuildingBoard = function(colour) {
  var bb = new BuildingBoard();

  var addPiece = function(type, x, y) {
    bb.addPiece(new Piece(type, colour), new Position(x, y));
  };

  var back = colour === 'white' ? 0 : 7;
  var front = colour === 'white' ? 1 : 6;
  addPiece('king', 0, back);
  addPiece('queen', 1, back);
  addPiece('bishop', 2, back);
  addPiece('rook', 3, back);
  addPiece('knight', 4, back);
  addPiece('pawn', 0, front);

  return bb;
};
var makeArmy = function(colour) {
  return makeBuildingBoard(colour).pieces;
};
return {
  makeBuildingBoard: makeBuildingBoard,
  makeArmy: makeArmy
};

});
