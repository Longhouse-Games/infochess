define(['spec/spec_helper', 'lib/helper'],
    function(SpecHelper, HelperModule) {

var Position = HelperModule.Position;
var Piece = HelperModule.Piece;

describe("Position.distanceTo", function() {
  var pos, result;

  it("should calculate diagonally", function() {
    pos = new Position(0,0);
    result = pos.distanceTo(new Position(2,2));
    expect(result).toBe(2);

    pos = new Position(2,2);
    result = pos.distanceTo(new Position(0,0));
    expect(result).toBe(2);

    pos = new Position(0,2);
    result = pos.distanceTo(new Position(2,0));
    expect(result).toBe(2);

    pos = new Position(2,0);
    result = pos.distanceTo(new Position(0,2));
    expect(result).toBe(2);
  });

  it("should calculate horizontally", function() {
    pos = new Position(3,0);
    result = pos.distanceTo(new Position(7,0));
    expect(result).toBe(4);

    pos = new Position(7,0);
    result = pos.distanceTo(new Position(3,0));
    expect(result).toBe(4);
  });

  it("should calculate vertically", function() {
    pos = new Position(1,1);
    result = pos.distanceTo(new Position(1,5));
    expect(result).toBe(4);

    pos = new Position(1,5);
    result = pos.distanceTo(new Position(1,1));
    expect(result).toBe(4);
  });

  it("should calculate when given a position that is not directly reachable", function() {
    pos = new Position(0,0);
    result = pos.distanceTo(new Position(1,2));
    expect(result).toBe(2);

    pos = new Position(0,0);
    result = pos.distanceTo(new Position(2,1));
    expect(result).toBe(2);

    pos = new Position(4,4);
    result = pos.distanceTo(new Position(5,7));
    expect(result).toBe(3);

    pos = new Position(0,0);
    result = pos.distanceTo(new Position(5,7));
    expect(result).toBe(7);
  });
});

return {
  name: "helper_spec"
};
});
