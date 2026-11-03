-- CreateIndex
CREATE INDEX `Content_status_createdAt_idx` ON `Content`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `Demisioner_organization_periode_nama_idx` ON `Demisioner`(`organization`, `periode`, `nama`);

-- CreateIndex
CREATE INDEX `PublicComment_createdAt_idx` ON `PublicComment`(`createdAt`);

-- CreateIndex
CREATE INDEX `Ticket_createdAt_idx` ON `Ticket`(`createdAt`);
