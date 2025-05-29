// src/pages/AddMerchant.jsx
import {addMerchant} from "../../api/merchants";

import { useState } from "react";

const AddMerchants = () => {
  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    email: "",
    phoneNumber: "",
    password: "",
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Submitting...");

    try {
      const res = await addMerchant(form);
          if (res.ok) {
        setMessage("Merchant added successfully.");
        setForm({
          shopName: "",
          ownerName: "",
          email: "",
          phoneNumber: "",
          password: "",
        });
      } else {
        setMessage(`Error: ${res.message || "Something went wrong"}`);
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      setMessage("Error connecting to server.");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Add Merchant</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="shopName"
          placeholder="Shop Name"
          value={form.shopName}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          name="ownerName"
          placeholder="Owner Name"
          value={form.ownerName}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="tel"
          name="phoneNumber"
          placeholder="Phone Number"
          value={form.phoneNumber}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add Merchant
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
};

export default AddMerchants;
