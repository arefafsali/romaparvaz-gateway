export function generateMatrix<T>(data: T[][]): T[][] {
  let totalCount = data.reduce((a, b) => a * b.length, 1);
  let result: T[][] = [];
  if (data.length == 0 || totalCount == 0)
    return result;
  else {
    data.reverse();
    for (let _matrix_index = 0; _matrix_index < totalCount; _matrix_index++) {
      let _temp_index = _matrix_index;
      result.push(data.map(el => {
        let _index = _temp_index % el.length;
        _temp_index = Math.floor(_temp_index / el.length);
        return el[_index];
      }).reverse())
    }
    return result;
  }
}