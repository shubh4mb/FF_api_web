import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
    zoneName:{type:String},
    city: { type: String, required: true },                   // "Kochi"
  state: { type: String, required: true },                  // "Kerala"
  boundary: {                                               // Optional polygon for precise detection
    type: { type: String, enum: ['Polygon'], default: 'Polygon' },
    coordinates: { type: [[[Number]]], required: false }    // [[ [lng, lat], ... ]]
  },
    centerCoordinaties:{
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [lng, lat]
    }, 
})
zoneSchema.index({ boundary: '2dsphere' });
zoneSchema.index({centerCoordinaties:'2dsphere'})

export default mongoose.model("Zone", zoneSchema);