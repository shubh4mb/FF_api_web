import { useState } from "react";

export default function DynamicFeaturesInput({ features, setFeatures }) {
  const [entries, setEntries] = useState(
    Object.entries(features || {})
  );

  const handleChange = (index, keyOrValue, value) => {
    const updated = [...entries];
    updated[index] = {
      ...updated[index],
      [keyOrValue]: value,
    };
    setEntries(updated);
    syncToMap(updated);
  };

  const syncToMap = (updated) => {
    const asObject = Object.fromEntries(
      updated.map((e) => [e.key, e.value]).filter(e => e[0]) // remove empty keys
    );
    setFeatures(asObject);
  };

  const addFeature = () => {
    setEntries([...entries, { key: "", value: "" }]);
  };

  const removeFeature = (index) => {
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
    syncToMap(updated);
  };

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Product Features</h3>
      {entries.map((entry, index) => (
        <div key={index} className="flex space-x-2 mb-2">
          <input
            type="text"
            placeholder="Feature Name"
            value={entry.key || ""}
            onChange={(e) => handleChange(index, "key", e.target.value)}
            className="border p-2 rounded w-1/2"
          />
          <input
            type="text"
            placeholder="Feature Value"
            value={entry.value || ""}
            onChange={(e) => handleChange(index, "value", e.target.value)}
            className="border p-2 rounded w-1/2"
          />
          <button
            onClick={() => removeFeature(index)}
            className="bg-red-500 text-white px-2 rounded"
          >
            X
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addFeature}
        className="bg-blue-500 text-white px-4 py-1 rounded"
      >
        + Add Feature
      </button>
    </div>
  );
}
