# Test Assets

Use `test-assets/originals/` for manual input files that help exercise the full user journey.

Example files:

- `test-assets/originals/sample.jpg`
- `test-assets/originals/sample.png`
- `test-assets/originals/sample.heic`

Derived files are not written back into this repository.

In this project, the worker writes processed outputs to Azurite Blob Storage under:

- `derived/{jobId}/image-1200.webp`
- `derived/{jobId}/image-thumb.webp`

That is the best place to inspect outputs because it matches the real application flow.

To inspect derived blobs during development, use either:

- Azure Storage Explorer connected to Azurite
- Azurite's `media` blob container and the `derived/{jobId}/...` paths
