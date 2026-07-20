const fs = require('fs')
const path = require('path')

// Path to the JSON file
const filePath = path.join(__dirname, 'projected.json')

// Read the JSON file
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err)
    return
  }

  // Parse the JSON content
  let jsonContent
  try {
    jsonContent = JSON.parse(data)
  } catch (parseErr) {
    console.error('Error parsing JSON:', parseErr)
    return
  }

  // Iterate through each geometry and add the "id" below "arcs"
  const geometries = jsonContent.objects.states.geometries
  geometries.forEach(geometry => {
    if (geometry.properties && geometry.properties.id) {
      geometry.id = geometry.properties.id
    }
  })

  // Convert the modified JSON back to a string
  const modifiedJson = JSON.stringify(jsonContent, null, 2)

  // Write the modified JSON back to the file
  fs.writeFile(filePath, modifiedJson, 'utf8', writeErr => {
    if (writeErr) {
      console.error('Error writing the file:', writeErr)
    } else {
      console.log('File successfully updated.')
    }
  })
})
